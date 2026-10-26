import type { QueryCommand } from "@aws-sdk/client-dynamodb";
import { describe, expect, it } from "vitest";
import { HttpError } from "../http-error.js";
import type { DynamoCaller } from "../services/credentials.js";
import { encodeQueryCursor } from "./query-cursor.js";
import { queryTable, type QueryTableInput } from "./query.js";

function caller(
  send: (command: { readonly input?: object; readonly constructor: { name: string } }) => unknown,
): DynamoCaller {
  return {
    destroy() {
      return undefined;
    },
    send(command) {
      return Promise.resolve(
        send(command as { readonly input?: object; readonly constructor: { name: string } }),
      );
    },
  };
}

function base(): QueryTableInput {
  return {
    table: "orders",
    partitionKey: { name: "userId", value: { S: "user-0001" } },
    sortKey: {
      name: "createdAt",
      op: "between",
      value: { S: "a" },
      value2: { S: "z" },
    },
    scanForward: false,
    limit: 2,
    filterJoiner: "and",
  };
}

describe("queryTable", () => {
  it("sends the key condition and returns that request", async () => {
    const client = caller((command) => {
      const input = command.input as QueryCommand["input"];
      expect(input.KeyConditionExpression).toBe("#n0 = :v0 AND #n1 BETWEEN :v1 AND :v2");
      expect(input.ExpressionAttributeNames).toEqual({ "#n0": "userId", "#n1": "createdAt" });
      expect(input.ScanIndexForward).toBe(false);
      return {
        Items: [{ userId: { S: "user-0001" }, createdAt: { S: "b" } }],
        Count: 1,
        ScannedCount: 1,
      };
    });
    const page = await queryTable(client, "http://127.0.0.1:8000", base());
    expect(page.request.KeyConditionExpression).toBe("#n0 = :v0 AND #n1 BETWEEN :v1 AND :v2");
    expect(page.request.ExpressionAttributeNames).toEqual({ "#n0": "userId", "#n1": "createdAt" });
    expect(page.request.ScanIndexForward).toBe(false);
    expect(page.items).toHaveLength(1);
  });

  it("rejects a filter on a key attribute and a mismatched cursor", async () => {
    const client = caller(() => {
      throw new Error("should not query");
    });
    await expect(
      queryTable(client, "", {
        ...base(),
        filters: [{ attribute: "userId", op: "=", value: { S: "other" } }],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const cursor = encodeQueryCursor(
      { userId: { S: "user-0001" } },
      {
        table: "orders",
        partitionKeyName: "userId",
        partitionKeyValue: { S: "user-0001" },
        scanForward: true,
        filterJoiner: "and",
      },
    );
    await expect(queryTable(client, "", { ...base(), cursor })).rejects.toBeInstanceOf(HttpError);
  });

  it("rejects consistent read on a global secondary index before querying", async () => {
    const sent: string[] = [];
    const client = caller((command) => {
      sent.push(command.constructor.name);
      return {
        Table: { GlobalSecondaryIndexes: [{ IndexName: "status-createdAt-index" }] },
      };
    });
    await expect(
      queryTable(client, "", {
        ...base(),
        index: "status-createdAt-index",
        partitionKey: { name: "status", value: { S: "SHIPPED" } },
        consistentRead: true,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(sent).toEqual(["DescribeTableCommand"]);
  });
});
