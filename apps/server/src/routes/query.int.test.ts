import { describe, expect, it } from "vitest";
import { CSRF_HEADER, QueryResponse, type AttributeValue } from "@dynamo-studio/shared";
import { buildApp } from "../app.js";

async function session(app: Awaited<ReturnType<typeof buildApp>>): Promise<{
  cookie: string;
  csrf: string;
}> {
  const response = await app.inject({ method: "GET", url: "/api/v1/session" });
  const header = response.headers["set-cookie"];
  const line = Array.isArray(header) ? header[0] : header;
  if (line === undefined) {
    throw new Error("missing set-cookie");
  }
  return {
    cookie: line.split(";")[0] ?? line,
    csrf: response.json<{ csrfToken: string }>().csrfToken,
  };
}

function text(item: Record<string, AttributeValue>, name: string): string {
  const value = item[name];
  if (value === undefined || !("S" in value)) {
    throw new Error(`missing ${name}`);
  }
  return value.S;
}

describe("query against DynamoDB Local", () => {
  it("queries orders by user and createdAt, then the status index", async () => {
    const app = await buildApp();
    const open = await session(app);
    const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/connections",
      headers,
      payload: {
        endpoint: "http://127.0.0.1:8000",
        region: "us-east-1",
        auth: { type: "local" },
        env: "local",
        readOnly: true,
        remember: false,
      },
    });
    expect(created.statusCode).toBe(201);
    const connectionId = created.json<{ connectionId: string }>().connectionId;
    const query = async (payload: object) => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/orders/query`,
        headers,
        payload,
      });
      return response;
    };

    const first = await query({
      limit: 5,
      scanForward: false,
      key: { pk: { name: "userId", value: { S: "user-0001" } } },
    });
    expect(first.statusCode).toBe(200);
    const page = QueryResponse.parse(first.json());
    expect(page.count).toBe(5);
    const createdAt = page.items.map((item) => text(item, "createdAt"));
    expect([...createdAt].sort().reverse()).toEqual(createdAt);
    const low = createdAt[createdAt.length - 1];
    const high = createdAt[0];
    if (low === undefined || high === undefined) {
      throw new Error("missing bounds");
    }

    const ranged = await query({
      limit: 2,
      scanForward: false,
      key: {
        pk: { name: "userId", value: { S: "user-0001" } },
        sk: { name: "createdAt", op: "between", value: { S: low }, value2: { S: high } },
      },
    });
    const exact = QueryResponse.parse(ranged.json());
    expect(exact.items.map((item) => text(item, "createdAt"))).toEqual(createdAt.slice(0, 2));
    expect(exact.request.KeyConditionExpression).toContain("BETWEEN");
    expect(exact.request.ExpressionAttributeNames["#n0"]).toBe("userId");

    const reserved = await query({
      limit: 5,
      key: { pk: { name: "userId", value: { S: "user-0001" } } },
      filters: [
        { attribute: "name", op: "=", value: { S: "absent" } },
        { attribute: "timestamp", op: ">", value: { N: "0" } },
      ],
      filterJoiner: "or",
    });
    expect(reserved.statusCode).toBe(200);
    const reservedBody = QueryResponse.parse(reserved.json());
    expect(Object.values(reservedBody.request.ExpressionAttributeNames)).toEqual(
      expect.arrayContaining(["name", "timestamp", "userId"]),
    );

    const index = await query({
      limit: 5,
      index: "status-createdAt-index",
      key: {
        pk: { name: "status", value: { S: "SHIPPED" } },
        sk: { name: "createdAt", op: "begins_with", value: { S: "2024" } },
      },
    });
    const gsi = QueryResponse.parse(index.json());
    expect(gsi.count).toBeGreaterThan(0);
    expect(gsi.items.every((item) => text(item, "status") === "SHIPPED")).toBe(true);
    expect(gsi.request.IndexName).toBe("status-createdAt-index");

    const consistent = await query({
      limit: 5,
      index: "status-createdAt-index",
      consistentRead: true,
      key: { pk: { name: "status", value: { S: "SHIPPED" } } },
    });
    expect(consistent.statusCode).toBe(400);
    expect(consistent.json<{ error: { code: string } }>().error.code).toBe("VALIDATION");

    const cursor = exact.nextCursor;
    expect(cursor).toBeDefined();
    const mismatched = await query({
      limit: 2,
      scanForward: true,
      cursor,
      key: {
        pk: { name: "userId", value: { S: "user-0001" } },
        sk: { name: "createdAt", op: "between", value: { S: low }, value2: { S: high } },
      },
    });
    expect(mismatched.statusCode).toBe(400);
    expect(mismatched.json<{ error: { code: string } }>().error.code).toBe("VALIDATION");
    await app.close();
  });
});
