import { describe, expect, it } from "vitest";
import { CONFIRM_HEADER, CSRF_HEADER, PartiqlResponse } from "@dynamo-studio/shared";
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

async function connect(
  app: Awaited<ReturnType<typeof buildApp>>,
  open: { cookie: string; csrf: string },
  readOnly: boolean,
): Promise<string> {
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/connections",
    headers: { cookie: open.cookie, [CSRF_HEADER]: open.csrf },
    payload: {
      endpoint: "http://127.0.0.1:8000",
      region: "us-east-1",
      auth: { type: "local" },
      env: "local",
      readOnly,
      remember: false,
    },
  });
  expect(created.statusCode).toBe(201);
  return created.json<{ connectionId: string }>().connectionId;
}

describe("partiql against DynamoDB Local", () => {
  it("selects with a parameter, pages, and guards mutations", async () => {
    const app = await buildApp();
    const open = await session(app);
    const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
    const writable = await connect(app, open, false);
    const readOnly = await connect(app, open, true);
    const post = async (connectionId: string, payload: object, extra?: Record<string, string>) =>
      app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/partiql`,
        headers: { ...headers, ...extra },
        payload,
      });

    const selected = await post(writable, {
      statement: 'SELECT * FROM "users" WHERE "id" = ?',
      parameters: [{ S: "user-0001" }],
      limit: 5,
    });
    expect(selected.statusCode).toBe(200);
    const one = PartiqlResponse.parse(selected.json());
    expect(one.kind).toBe("select");
    expect(one.items).toEqual([
      expect.objectContaining({ id: { S: "user-0001" }, email: { S: "user-0001@example.com" } }),
    ]);

    const page = await post(writable, { statement: 'SELECT * FROM "users"', limit: 1 });
    const first = PartiqlResponse.parse(page.json());
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeDefined();
    const next = await post(writable, {
      statement: 'SELECT * FROM "users"',
      limit: 1,
      cursor: first.nextCursor,
    });
    const second = PartiqlResponse.parse(next.json());
    expect(second.items).toHaveLength(1);
    expect(second.items).not.toEqual(first.items);
    const mismatched = await post(writable, {
      statement: 'SELECT * FROM "users" WHERE "id" = ?',
      parameters: [{ S: "user-0001" }],
      limit: 1,
      cursor: first.nextCursor,
    });
    expect(mismatched.statusCode).toBe(400);
    expect(mismatched.json<{ error: { code: string } }>().error.code).toBe("VALIDATION");

    const readOnlyUpdate = await post(
      readOnly,
      { statement: 'UPDATE "users" SET "name" = \'x\' WHERE "id" = \'user-0001\'' },
      { [CONFIRM_HEADER]: "mutation" },
    );
    expect(readOnlyUpdate.statusCode).toBe(403);
    expect(readOnlyUpdate.json<{ error: { code: string } }>().error.code).toBe("READ_ONLY");

    const inserted = await post(
      writable,
      {
        statement:
          "INSERT INTO \"users\" VALUE {'id': 'p6-partiql', 'email': 'p6-partiql@example.test', 'name': 'p6'}",
      },
      { [CONFIRM_HEADER]: "mutation" },
    );
    expect(inserted.statusCode).toBe(200);
    expect(PartiqlResponse.parse(inserted.json()).kind).toBe("mutation");

    const unconfirmed = await post(writable, {
      statement: 'UPDATE "users" SET "name" = \'changed\' WHERE "id" = \'p6-partiql\'',
    });
    expect(unconfirmed.statusCode).toBe(400);
    expect(unconfirmed.json<{ error: { code: string } }>().error.code).toBe("VALIDATION");

    const impliedSelect = await post(
      writable,
      { statement: 'DELETE FROM "users" WHERE "id" = \'p6-partiql\'' },
      { [CONFIRM_HEADER]: "select" },
    );
    expect(impliedSelect.statusCode).toBe(400);
    expect(impliedSelect.json<{ error: { code: string } }>().error.code).toBe("VALIDATION");
    const stillThere = await post(writable, {
      statement: 'SELECT * FROM "users" WHERE "id" = ?',
      parameters: [{ S: "p6-partiql" }],
    });
    expect(PartiqlResponse.parse(stillThere.json()).items).toHaveLength(1);

    const removed = await post(
      writable,
      { statement: 'DELETE FROM "users" WHERE "id" = \'p6-partiql\'' },
      { [CONFIRM_HEADER]: "mutation" },
    );
    expect(removed.statusCode).toBe(200);

    const syntax = await post(writable, { statement: 'SELECT * FROM "users" WHERE' });
    expect(syntax.statusCode).toBe(400);
    const syntaxBody = syntax.json<{
      error: {
        code: string;
        message: string;
        details?: { position?: { line: number; column: number } };
      };
    }>();
    expect(syntaxBody.error.code).toBe("PARTIQL_ERROR");
    expect(syntaxBody.error.details?.position).toBeUndefined();

    const huge = await post(writable, { statement: `SELECT ${"a".repeat(8200)}` });
    expect(huge.statusCode).toBe(400);
    expect(huge.json<{ error: { code: string } }>().error.code).toBe("LIMIT_EXCEEDED");
    await app.close();
  });
});
