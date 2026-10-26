import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceInUseException,
  DynamoDBClient,
  UpdateTimeToLiveCommand,
  type CreateTableCommandInput,
} from "@aws-sdk/client-dynamodb";
import { afterAll, describe, expect, it } from "vitest";
import { CSRF_HEADER, TableDescription, TableListResponse } from "@dynamo-studio/shared";
import { deleteLocalTables, uniqueToken } from "../local-cleanup.js";
import { buildApp } from "../app.js";

function pageNames(prefix: string): string[] {
  return Array.from({ length: 101 }, (_unused, index) => {
    return `${prefix}${String(index).padStart(3, "0")}`;
  });
}

let created: string[] = [];

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

const seedTables: CreateTableCommandInput[] = [
  {
    TableName: "users",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "email-index",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: "orders",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "S" },
      { AttributeName: "status", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "createdAt", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "status-createdAt-index",
        KeySchema: [
          { AttributeName: "status", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: "sessions",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  },
  {
    TableName: "edge-cases",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  },
];

function localClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: "us-east-1",
    endpoint: "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
}

async function ensureGenerated(names: readonly string[]): Promise<void> {
  const client = localClient();
  try {
    for (const name of names) {
      try {
        await client.send(
          new CreateTableCommand({
            TableName: name,
            BillingMode: "PAY_PER_REQUEST",
            AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
            KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
          }),
        );
      } catch (error) {
        if (!(error instanceof ResourceInUseException)) {
          throw error;
        }
      }
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const described = await client.send(new DescribeTableCommand({ TableName: name }));
        if (described.Table?.TableStatus === "ACTIVE") {
          break;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 50);
        });
      }
    }
    for (const input of seedTables) {
      try {
        await client.send(new CreateTableCommand(input));
      } catch (error) {
        if (!(error instanceof ResourceInUseException)) {
          throw error;
        }
      }
    }
    try {
      await client.send(
        new UpdateTimeToLiveCommand({
          TableName: "sessions",
          TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
        }),
      );
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name !== "ValidationException" && !(error instanceof ResourceInUseException)) {
        throw error;
      }
    }
  } finally {
    client.destroy();
  }
}

describe("table routes against DynamoDB Local", () => {
  afterAll(async () => {
    await deleteLocalTables(created);
  });

  it("lists seed tables, describes orders and sessions, and pages a dotted name", async () => {
    const token = uniqueToken();
    const prefix = `p3${token}-`;
    const dotted = `my.table-${token}`;
    const names = pageNames(prefix);
    created = [...names, dotted];
    try {
      await ensureGenerated(created);
      const app = await buildApp();
      const open = await session(app);
      const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
      const connected = await app.inject({
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
      expect(connected.statusCode).toBe(201);
      const connectionId = connected.json<{ connectionId: string }>().connectionId;

      const names = new Set<string>();
      let cursor: string | undefined;
      for (let page = 0; page < 20; page += 1) {
        const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
        const listed = await app.inject({
          method: "GET",
          url: `/api/v1/connections/${connectionId}/tables${query}`,
          headers,
        });
        expect(listed.statusCode).toBe(200);
        const body = TableListResponse.parse(listed.json());
        for (const name of body.tables) {
          names.add(name);
        }
        cursor = body.nextCursor;
        if (cursor === undefined) {
          break;
        }
      }
      expect(names.has("users")).toBe(true);
      expect(names.has("orders")).toBe(true);
      expect(names.has("sessions")).toBe(true);
      expect(names.has("edge-cases")).toBe(true);

      const orders = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${connectionId}/tables/orders`,
        headers,
      });
      const described = TableDescription.parse(orders.json());
      expect(described.keySchema.map((key) => key.name)).toEqual(["userId", "createdAt"]);
      expect(described.gsis.map((index) => index.name)).toContain("status-createdAt-index");

      const sessions = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${connectionId}/tables/sessions`,
        headers,
      });
      expect(TableDescription.parse(sessions.json()).ttl).toEqual({
        enabled: true,
        attribute: "expiresAt",
      });

      const dottedPage = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${connectionId}/tables/${encodeURIComponent(dotted)}`,
        headers,
      });
      expect(TableDescription.parse(dottedPage.json()).name).toBe(dotted);

      const missing = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${connectionId}/tables/not-a-real-table`,
        headers,
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.json<{ error: { code: string } }>().error.code).toBe("NOT_FOUND");

      const waited = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/orders/wait`,
        headers,
      });
      expect(waited.statusCode).toBe(200);
      expect(waited.json<{ status: string }>().status).toBe("ACTIVE");

      const searched: string[] = [];
      let searchCursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const params = new URLSearchParams({ search: prefix, limit: "100" });
        if (searchCursor !== undefined) {
          params.set("cursor", searchCursor);
        }
        const found = await app.inject({
          method: "GET",
          url: `/api/v1/connections/${connectionId}/tables?${params.toString()}`,
          headers,
        });
        const body = TableListResponse.parse(found.json());
        searched.push(...body.tables);
        searchCursor = body.nextCursor;
        if (searchCursor === undefined) {
          break;
        }
      }
      expect(searched).toHaveLength(101);
      expect(searched.every((name) => name.startsWith(prefix))).toBe(true);
    } finally {
      await deleteLocalTables(created);
    }
  }, 180_000);
});
