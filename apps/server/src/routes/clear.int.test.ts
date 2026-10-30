import { afterAll, describe, expect, it } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";
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

describe("clear table against DynamoDB Local", () => {
  afterAll(async () => {
    await deleteLocalTables(created);
  });

  it("requires the typed name, refuses a read-only connection, and deletes the items", async () => {
    const name = `p7c${uniqueToken()}`;
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
      const connectionId = connected.json<{ connectionId: string }>().connectionId;
      const createdTable = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables`,
        headers,
        payload: { name, partitionKey: { name: "id", type: "S" } },
      });
      expect(createdTable.statusCode).toBe(202);
      for (const id of ["a", "b"]) {
        const put = await app.inject({
          method: "PUT",
          url: `/api/v1/connections/${connectionId}/tables/${name}/items`,
          headers,
          payload: { item: { id: { S: id }, note: { S: "x" } }, ifNotExists: true },
        });
        expect(put.statusCode).toBe(200);
      }
      const wrong = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${name}/clear`,
        headers,
        payload: { confirm: "nope" },
      });
      expect(wrong.statusCode).toBe(400);

      const readonly = await app.inject({
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
      const blocked = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${readonly.json<{ connectionId: string }>().connectionId}/tables/${name}/clear`,
        headers,
        payload: { confirm: name },
      });
      expect(blocked.statusCode).toBe(403);

      const cleared = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${name}/clear`,
        headers,
        payload: { confirm: name },
      });
      expect(cleared.statusCode).toBe(200);
      const line = cleared.body.split("\n").findLast((entry) => entry.includes('"done"'));
      expect(JSON.parse(line ?? "{}")).toMatchObject({ written: 2, failed: 0 });
      const scan = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${name}/scan`,
        headers,
        payload: { limit: 10, consistentRead: true },
      });
      expect(scan.json<{ items: unknown[] }>().items).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
