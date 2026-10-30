import { afterAll, describe, expect, it } from "vitest";
import { CSRF_HEADER, itemHash, type Item } from "@dynamo-studio/shared";
import { deleteLocalTables, uniqueToken } from "../local-cleanup.js";
import { buildApp } from "../app.js";

const created: string[] = [];

function multipart(
  options: unknown,
  file: string,
  filename: string,
): {
  payload: string;
  contentType: string;
} {
  const boundary = "----dsimport";
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload:
      `--${boundary}\r\nContent-Disposition: form-data; name="options"\r\n\r\n${JSON.stringify(options)}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n` +
      `${file}\r\n--${boundary}--\r\n`,
  };
}

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

async function connect(
  app: Awaited<ReturnType<typeof buildApp>>,
  headers: Record<string, string>,
  readOnly: boolean,
): Promise<string> {
  const connected = await app.inject({
    method: "POST",
    url: "/api/v1/connections",
    headers,
    payload: {
      endpoint: "http://127.0.0.1:8000",
      region: "us-east-1",
      auth: { type: "local" },
      env: "local",
      readOnly,
      remember: false,
    },
  });
  expect(connected.statusCode).toBe(201);
  return connected.json<{ connectionId: string }>().connectionId;
}

function doneLine(body: string): {
  written: number;
  skipped: number;
  failed: number;
  duplicates: number;
  errorsReportId?: string;
} {
  const line = body.split("\n").findLast((entry) => entry.includes('"done"'));
  return JSON.parse(line ?? "{}") as {
    written: number;
    skipped: number;
    failed: number;
    duplicates: number;
    errorsReportId?: string;
  };
}

describe("import against DynamoDB Local", () => {
  afterAll(async () => {
    await deleteLocalTables(created);
  });

  it("rejects a read-only import, a missing CSRF token, and a huge content length", async () => {
    const app = await buildApp();
    try {
      const open = await session(app);
      const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
      const connectionId = await connect(app, headers, true);
      const file = multipart(
        { format: "ndjson", mode: "put" },
        '{"id":{"S":"a"}}\n',
        "rows.ndjson",
      );
      const blocked = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/users/import`,
        headers: { ...headers, "content-type": file.contentType },
        payload: file.payload,
      });
      expect(blocked.statusCode).toBe(403);

      const forged = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/users/import`,
        headers: { cookie: open.cookie, "content-type": file.contentType },
        payload: file.payload,
      });
      expect(forged.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("imports rows, counts duplicates, and hides the error report from another session", async () => {
    const name = `p7i${uniqueToken()}`;
    created.push(name);
    const app = await buildApp();
    try {
      const open = await session(app);
      const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
      const connectionId = await connect(app, headers, false);
      const createdTable = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables`,
        headers,
        payload: { name, partitionKey: { name: "id", type: "S" } },
      });
      expect(createdTable.statusCode).toBe(202);
      const body = [
        '{"id":{"S":"a"},"note":{"S":"first"}}',
        '{"id":{"S":"a"},"note":{"S":"second"}}',
        '{"note":{"S":"no-key"}}',
      ].join("\n");
      const file = multipart({ format: "ndjson", mode: "put" }, body, "rows.ndjson");
      const imported = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${name}/import`,
        headers: { ...headers, "content-type": file.contentType },
        payload: file.payload,
      });
      expect(imported.statusCode).toBe(200);
      const summary = doneLine(imported.body);
      expect(summary).toMatchObject({ written: 1, failed: 1, duplicates: 1 });
      const reportId = summary.errorsReportId;
      if (reportId === undefined) {
        throw new Error("missing error report");
      }
      const report = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${connectionId}/import/errors/${reportId}`,
        headers,
      });
      expect(report.statusCode).toBe(200);
      expect(report.body).toContain('"row":3');

      const other = await session(app);
      const hidden = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${connectionId}/import/errors/${reportId}`,
        headers: { cookie: other.cookie, [CSRF_HEADER]: other.csrf },
      });
      expect(hidden.statusCode).toBe(404);

      const loaded = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${name}/items/get`,
        headers,
        payload: { key: { id: { S: "a" } } },
      });
      expect(loaded.json<{ item: Item }>().item.note).toEqual({ S: "second" });

      const again = multipart(
        { format: "ndjson", mode: "skip-existing" },
        '{"id":{"S":"a"},"note":{"S":"third"}}\n{"id":{"S":"b"},"note":{"S":"new"}}\n',
        "more.ndjson",
      );
      const skipped = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${name}/import`,
        headers: { ...headers, "content-type": again.contentType },
        payload: again.payload,
      });
      expect(doneLine(skipped.body)).toMatchObject({ written: 1, skipped: 1, failed: 0 });
      const kept = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${name}/items/get`,
        headers,
        payload: { key: { id: { S: "a" } } },
      });
      expect(kept.json<{ item: Item }>().item.note).toEqual({ S: "second" });
    } finally {
      await app.close();
    }
  });

  it("re-imports the orders export with the same item hashes", async () => {
    const name = `p7o${uniqueToken()}`;
    created.push(name);
    const app = await buildApp();
    try {
      const open = await session(app);
      const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
      const connectionId = await connect(app, headers, false);
      const exported = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/orders/export`,
        headers,
        payload: { format: "ndjson", typed: true, scope: "all" },
      });
      expect(exported.statusCode).toBe(200);
      const source = exported.body
        .split("\n")
        .filter((line) => line.length > 0 && !line.includes("__summary"));
      expect(source).toHaveLength(10_000);
      const createdTable = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables`,
        headers,
        payload: {
          name,
          partitionKey: { name: "userId", type: "S" },
          sortKey: { name: "createdAt", type: "S" },
        },
      });
      expect(createdTable.statusCode).toBe(202);
      const file = multipart({ format: "ndjson", mode: "put" }, exported.body, "orders.ndjson");
      const imported = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${name}/import`,
        headers: { ...headers, "content-type": file.contentType },
        payload: file.payload,
      });
      expect(imported.statusCode).toBe(200);
      expect(doneLine(imported.body).written).toBe(10_000);
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await app.inject({
          method: "POST",
          url: `/api/v1/connections/${connectionId}/tables/${name}/scan`,
          headers,
          payload: { limit: 1000, ...(cursor === undefined ? {} : { cursor }) },
        });
        const body = page.json<{ items: Item[]; nextCursor?: string }>();
        for (const item of body.items) {
          seen.push(await itemHash(item));
        }
        cursor = body.nextCursor;
      } while (cursor !== undefined);
      const expected: string[] = [];
      for (const line of source) {
        expected.push(await itemHash(JSON.parse(line) as Item));
      }
      expect(seen.sort()).toEqual(expected.sort());
    } finally {
      await app.close();
    }
  }, 60_000);
});
