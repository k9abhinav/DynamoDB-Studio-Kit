import { afterAll, describe, expect, it } from "vitest";
import { CSRF_HEADER, TableDescription } from "@dynamo-studio/shared";
import { deleteLocalTables, uniqueToken } from "../local-cleanup.js";
import { buildApp } from "../app.js";

const created: string[] = [];

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

async function waitUntilIndexesSettled(
  app: Awaited<ReturnType<typeof buildApp>>,
  connectionId: string,
  name: string,
  headers: Record<string, string>,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await app.inject({
      method: "GET",
      url: `/api/v1/connections/${connectionId}/tables/${name}`,
      headers,
    });
    const indexes = TableDescription.parse(current.json()).gsis;
    if (indexes.every((gsi) => gsi.status === "ACTIVE")) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
}

describe("table management against DynamoDB Local", () => {
  afterAll(async () => {
    await deleteLocalTables(created);
  });

  it("creates a protected table with a GSI and TTL, then deletes it after the name is typed", async () => {
    const name = `p7${uniqueToken()}`;
    created.push(name);
    const app = await buildApp();
    try {
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
          readOnly: false,
          remember: false,
        },
      });
      expect(connected.statusCode).toBe(201);
      const connectionId = connected.json<{ connectionId: string }>().connectionId;
      const createdTable = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables`,
        headers,
        payload: {
          name,
          partitionKey: { name: "id", type: "S" },
          deletionProtection: true,
          ttlAttribute: "expiresAt",
          gsis: [
            {
              name: `${name}-status`,
              partitionKey: { name: "status", type: "S" },
              projection: { type: "KEYS_ONLY" },
            },
          ],
        },
      });
      expect(createdTable.statusCode).toBe(202);
      const described = TableDescription.parse(createdTable.json());
      expect(described.status).toBe("ACTIVE");
      expect(described.deletionProtection).toBe(true);
      expect(described.ttl).toEqual({ enabled: true, attribute: "expiresAt" });
      expect(described.gsis.map((gsi) => gsi.name)).toEqual([`${name}-status`]);
      expect(described.billing).toEqual({ mode: "PAY_PER_REQUEST" });

      const duplicate = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables`,
        headers,
        payload: { name, partitionKey: { name: "id", type: "S" } },
      });
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.json()).toMatchObject({
        error: { code: "TABLE_IN_USE", message: "That table name is already in use." },
      });

      const dropped = await app.inject({
        method: "PATCH",
        url: `/api/v1/connections/${connectionId}/tables/${name}`,
        headers,
        payload: { gsiDelete: `${name}-status` },
      });
      expect(dropped.statusCode).toBe(200);
      await waitUntilIndexesSettled(app, connectionId, name, headers);
      const added = await app.inject({
        method: "PATCH",
        url: `/api/v1/connections/${connectionId}/tables/${name}`,
        headers,
        payload: {
          gsiCreate: {
            name: `${name}-kind`,
            partitionKey: { name: "kind", type: "S" },
            projection: { type: "ALL" },
          },
        },
      });
      expect(added.statusCode).toBe(200);
      expect(TableDescription.parse(added.json()).gsis.map((gsi) => gsi.name)).toContain(
        `${name}-kind`,
      );
      await waitUntilIndexesSettled(app, connectionId, name, headers);

      const wrong = await app.inject({
        method: "DELETE",
        url: `/api/v1/connections/${connectionId}/tables/${name}`,
        headers,
        payload: { confirm: "nope" },
      });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json()).toMatchObject({
        error: { code: "VALIDATION", message: "Type the table name to confirm." },
      });

      const blocked = await app.inject({
        method: "DELETE",
        url: `/api/v1/connections/${connectionId}/tables/${name}`,
        headers,
        payload: { confirm: name },
      });
      expect(blocked.statusCode).toBe(400);
      expect(blocked.json()).toMatchObject({
        error: {
          code: "VALIDATION",
          message: "Deletion protection is on. Turn it off, then delete the table.",
          details: { awsCode: "ValidationException" },
        },
      });

      const unlocked = await app.inject({
        method: "PATCH",
        url: `/api/v1/connections/${connectionId}/tables/${name}`,
        headers,
        payload: { deletionProtection: false },
      });
      expect(unlocked.statusCode).toBe(200);
      expect(TableDescription.parse(unlocked.json()).deletionProtection).toBe(false);

      const removed = await app.inject({
        method: "DELETE",
        url: `/api/v1/connections/${connectionId}/tables/${name}`,
        headers,
        payload: { confirm: name },
      });
      expect(removed.statusCode).toBe(204);
      const gone = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${connectionId}/tables/${name}`,
        headers,
      });
      expect(gone.statusCode).toBe(404);

      const billingName = `p7b${uniqueToken()}`;
      created.push(billingName);
      const plain = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables`,
        headers,
        payload: { name: billingName, partitionKey: { name: "id", type: "S" } },
      });
      expect(plain.statusCode).toBe(202);
      const switched = await app.inject({
        method: "PATCH",
        url: `/api/v1/connections/${connectionId}/tables/${billingName}`,
        headers,
        payload: { billing: { mode: "PROVISIONED", rcu: 1, wcu: 1 } },
      });
      expect(switched.statusCode).toBe(200);
      expect(TableDescription.parse(switched.json()).billing).toEqual({
        mode: "PROVISIONED",
        rcu: 1,
        wcu: 1,
      });
      const billedGone = await app.inject({
        method: "DELETE",
        url: `/api/v1/connections/${connectionId}/tables/${billingName}`,
        headers,
        payload: { confirm: billingName },
      });
      expect(billedGone.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });

  it("blocks create on a read-only connection before DynamoDB", async () => {
    const name = `p7ro${uniqueToken()}`;
    const app = await buildApp();
    try {
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
      const connectionId = connected.json<{ connectionId: string }>().connectionId;
      const denied = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables`,
        headers,
        payload: { name, partitionKey: { name: "id", type: "S" } },
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json()).toMatchObject({ error: { code: "READ_ONLY" } });
    } finally {
      await app.close();
    }
  });
});
