import type { ScanCommand } from "@aws-sdk/client-dynamodb";
import { describe, expect, it } from "vitest";
import { HttpError } from "../http-error.js";
import type { DynamoCaller } from "../services/credentials.js";
import { encodeScanCursor } from "./scan-cursor.js";
import { scanTable } from "./scan.js";

const digits = "12345678901234567890123456789012345678";

function caller(
  send: (command: { readonly input?: object }, options?: { abortSignal?: AbortSignal }) => unknown,
): DynamoCaller {
  return {
    destroy() {},
    send(command, options) {
      return Promise.resolve(send(command, options));
    },
  };
}

function inputOf(command: { readonly input?: object } | undefined): ScanCommand["input"] {
  return (command?.input ?? {}) as ScanCommand["input"];
}

describe("scanTable", () => {
  it("fills a page across calls and sums scanned count and capacity", async () => {
    let calls = 0;
    const client = caller((command) => {
      calls += 1;
      const limit = inputOf(command).Limit ?? 0;
      const take = Math.min(10, limit);
      return {
        Items: Array.from({ length: take }, (_unused, index) => ({
          id: { S: `${String(calls)}-${String(index)}` },
        })),
        Count: take,
        ScannedCount: take + 2,
        ConsumedCapacity: { CapacityUnits: 0.5 },
        LastEvaluatedKey: { id: { S: `page-${String(calls)}` } },
      };
    });
    const page = await scanTable(client, "http://127.0.0.1:8000", {
      table: "orders",
      limit: 25,
      filterJoiner: "and",
      fillPage: true,
    });
    expect(calls).toBe(3);
    expect(page.count).toBe(25);
    expect(page.scannedCount).toBe(31);
    expect(page.consumedCapacity).toEqual({ rcu: 1.5 });
    expect(page.hasMore).toBe(true);
    expect(page.items[0]?.id).toEqual({ S: "1-0" });
  });

  it("stops after one call when fillPage is omitted", async () => {
    let calls = 0;
    const client = caller(() => {
      calls += 1;
      return {
        Items: [{ id: { S: "a" } }],
        Count: 1,
        ScannedCount: 1,
        LastEvaluatedKey: { id: { S: "a" } },
      };
    });
    const page = await scanTable(client, "", {
      table: "orders",
      limit: 50,
      filterJoiner: "and",
    });
    expect(calls).toBe(1);
    expect(page.hasMore).toBe(true);
    expect(page.consumedCapacity).toBeUndefined();
  });

  it("stops the fill loop on the time budget and on the call budget", async () => {
    let time = 0;
    let timedCalls = 0;
    const timed = caller(() => {
      timedCalls += 1;
      time += 2_500;
      return { Items: [], Count: 0, ScannedCount: 4, LastEvaluatedKey: { id: { S: "a" } } };
    });
    const partial = await scanTable(timed, "", {
      table: "orders",
      limit: 50,
      filterJoiner: "and",
      fillPage: true,
      now: () => time,
    });
    expect(timedCalls).toBe(1);
    expect(partial.items).toEqual([]);
    expect(partial.hasMore).toBe(true);
    expect(partial.scannedCount).toBe(4);

    let budgetCalls = 0;
    const budget = caller(() => {
      budgetCalls += 1;
      return {
        Items: [],
        Count: 0,
        ScannedCount: 1,
        LastEvaluatedKey: { id: { S: String(budgetCalls) } },
      };
    });
    const stopped = await scanTable(budget, "", {
      table: "orders",
      limit: 50,
      filterJoiner: "and",
      fillPage: true,
    });
    expect(budgetCalls).toBe(10);
    expect(stopped.hasMore).toBe(true);
  });

  it("does not call DynamoDB again after the caller aborts", async () => {
    const controller = new AbortController();
    let calls = 0;
    const client = caller(() => {
      calls += 1;
      controller.abort();
      return {
        Items: [{ id: { S: "a" } }],
        Count: 1,
        ScannedCount: 1,
        LastEvaluatedKey: { id: { S: "a" } },
      };
    });
    await expect(
      scanTable(client, "", {
        table: "orders",
        limit: 50,
        filterJoiner: "and",
        fillPage: true,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(1);
  });

  it("keeps a 38-digit filter value as a string and aliases reserved words", async () => {
    let seen: ScanCommand["input"] | undefined;
    const client = caller((command) => {
      seen = inputOf(command);
      return { Items: [], Count: 0, ScannedCount: 0 };
    });
    await scanTable(client, "", {
      table: "edge-cases",
      limit: 5,
      filterJoiner: "and",
      filters: [{ attribute: "digits", op: "=", value: { N: digits } }],
    });
    expect(seen?.FilterExpression).toBe("(#n0 = :v0)");
    expect(seen?.ExpressionAttributeNames).toEqual({ "#n0": "digits" });
    expect(seen?.ExpressionAttributeValues?.[":v0"]).toEqual({ N: digits });
    expect(seen?.FilterExpression?.includes(digits)).toBe(false);
    const value = seen?.ExpressionAttributeValues?.[":v0"];
    expect(value !== undefined && "N" in value && typeof value.N).toBe("string");

    await scanTable(client, "", {
      table: "orders",
      limit: 5,
      filterJoiner: "and",
      filters: [{ attribute: "status", op: "=", value: { S: "SHIPPED" } }],
      projection: ["status", "orderId"],
    });
    expect(seen?.FilterExpression).toBe("(#n0 = :v0)");
    expect(seen?.ProjectionExpression).toBe("#n0, #n1");
    expect(seen?.ExpressionAttributeNames).toEqual({ "#n0": "status", "#n1": "orderId" });
    expect(seen?.FilterExpression?.includes("status")).toBe(false);
    expect(seen?.FilterExpression?.includes("SHIPPED")).toBe(false);
  });

  it("sends the index, projection, and the previous key", async () => {
    const cursor = encodeScanCursor(
      { id: { S: "a" } },
      {
        table: "orders",
        index: "status-createdAt-index",
        filterJoiner: "and",
        consistentRead: true,
      },
    );
    let seen: ScanCommand["input"] | undefined;
    const client = caller((command) => {
      seen = inputOf(command);
      return { Items: [], Count: 0, ScannedCount: 1 };
    });
    const page = await scanTable(client, "", {
      table: "orders",
      index: "status-createdAt-index",
      limit: 10,
      cursor,
      filterJoiner: "and",
      consistentRead: true,
      segment: { index: 1, total: 4 },
    });
    expect(seen?.IndexName).toBe("status-createdAt-index");
    expect(seen?.ConsistentRead).toBe(true);
    expect(seen?.Segment).toBe(1);
    expect(seen?.TotalSegments).toBe(4);
    expect(seen?.ExclusiveStartKey).toEqual({ id: { S: "a" } });
    expect(seen?.ReturnConsumedCapacity).toBe("TOTAL");
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeUndefined();
  });

  it("rejects a cursor from a different filter before calling DynamoDB", async () => {
    const cursor = encodeScanCursor(
      { id: { S: "a" } },
      {
        table: "orders",
        filterJoiner: "and",
        filters: [{ attribute: "status", op: "=", value: { S: "SHIPPED" } }],
      },
    );
    let calls = 0;
    const client = caller(() => {
      calls += 1;
      return { Items: [], Count: 0, ScannedCount: 0 };
    });
    await expect(
      scanTable(client, "", {
        table: "orders",
        limit: 10,
        cursor,
        filterJoiner: "and",
        filters: [{ attribute: "status", op: "=", value: { S: "PENDING" } }],
      }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(calls).toBe(0);
  });

  it("turns binary attributes into base64 and leaves numbers as strings", async () => {
    const client = caller(() => ({
      Items: [
        {
          id: { S: "binary" },
          payload: { B: Buffer.from("hello") },
          digits: { N: digits },
        },
      ],
      Count: 1,
      ScannedCount: 1,
    }));
    const page = await scanTable(client, "", {
      table: "edge-cases",
      limit: 5,
      filterJoiner: "and",
    });
    expect(page.items[0]?.payload).toEqual({ B: Buffer.from("hello").toString("base64") });
    expect(page.items[0]?.digits).toEqual({ N: digits });
  });
});
