import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { describe, expect, it } from "vitest";
import { CSRF_HEADER, ScanResponse } from "@dynamo-studio/shared";
import { buildApp } from "../app.js";
import type { DynamoCaller } from "../services/credentials.js";

const digits = "12345678901234567890123456789012345678";

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

async function connect(app: Awaited<ReturnType<typeof buildApp>>, cookie: string, csrf: string) {
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/connections",
    headers: { cookie, [CSRF_HEADER]: csrf },
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
  return created.json<{ connectionId: string }>().connectionId;
}

describe("scan against DynamoDB Local", () => {
  it("filters orders and edge-cases, pages, and projects", async () => {
    const app = await buildApp();
    const open = await session(app);
    const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
    const connectionId = await connect(app, open.cookie, open.csrf);
    const scan = async (table: string, payload: object) => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/${encodeURIComponent(table)}/scan`,
        headers,
        payload,
      });
      expect(response.statusCode).toBe(200);
      return ScanResponse.parse(response.json());
    };

    const shipped = await scan("orders", {
      limit: 20,
      fillPage: true,
      filters: [{ attribute: "status", op: "=", value: { S: "SHIPPED" } }],
    });
    expect(shipped.count).toBeGreaterThan(0);
    expect(shipped.scannedCount).toBeGreaterThan(shipped.count);
    expect(
      shipped.items.every((item) => {
        const status = item.status;
        return status !== undefined && "S" in status && status.S === "SHIPPED";
      }),
    ).toBe(true);

    const nested = await scan("edge-cases", {
      limit: 5,
      fillPage: true,
      filters: [{ attribute: "address.city", op: "=", value: { S: "Pune" } }],
    });
    expect(nested.items.map((item) => item.id)).toEqual([{ S: "address-pune" }]);

    const precise = await scan("edge-cases", {
      limit: 5,
      fillPage: true,
      filters: [{ attribute: "digits", op: "=", value: { N: digits } }],
    });
    expect(precise.items).toHaveLength(1);
    expect(precise.items[0]?.digits).toEqual({ N: digits });

    const projected = await scan("orders", { limit: 5, projection: ["status"] });
    expect(projected.items[0]?.status).toBeDefined();
    expect(projected.items[0]?.orderId).toBeUndefined();

    const indexed = await scan("orders", { limit: 5, index: "status-createdAt-index" });
    expect(indexed.items.length).toBeGreaterThan(0);
    expect(indexed.items[0]?.status).toBeDefined();

    const first = await scan("orders", { limit: 1 });
    expect(first.hasMore).toBe(true);
    const second = await scan("orders", { limit: 1, cursor: first.nextCursor });
    expect(second.items[0]?.createdAt).not.toEqual(first.items[0]?.createdAt);

    let seen = 0;
    let cursor: string | undefined;
    const keys = new Set<string>();
    for (let page = 0; page < 20; page += 1) {
      const body = await scan("orders", {
        limit: 1000,
        ...(cursor === undefined ? {} : { cursor }),
      });
      seen += body.count;
      for (const item of body.items) {
        keys.add(JSON.stringify([item.userId, item.createdAt]));
      }
      cursor = body.nextCursor;
      if (cursor === undefined) {
        break;
      }
    }
    expect(seen).toBe(10_000);
    expect(keys.size).toBe(10_000);

    const denied = await app.inject({
      method: "POST",
      url: `/api/v1/connections/${connectionId}/tables/orders/scan`,
      headers: { cookie: open.cookie },
      payload: { limit: 1 },
    });
    expect(denied.statusCode).toBe(401);
    await app.close();
  }, 120_000);

  it("stops DynamoDB calls when the scan request is aborted", async () => {
    let scans = 0;
    const createClient = (): DynamoCaller => ({
      destroy() {},
      send(command, options) {
        if (!(command instanceof ScanCommand)) {
          return Promise.resolve({ TableNames: ["orders"] });
        }
        scans += 1;
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              Items: [],
              Count: 0,
              ScannedCount: 1,
              LastEvaluatedKey: { id: { S: "more" } },
            });
          }, 30_000);
          const abort = () => {
            clearTimeout(timer);
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          };
          if (options?.abortSignal?.aborted === true) {
            abort();
            return;
          }
          options?.abortSignal?.addEventListener("abort", abort, { once: true });
        });
      },
    });
    const app = await buildApp({ createClient });
    const open = await session(app);
    const connectionId = await connect(app, open.cookie, open.csrf);
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a port");
    }
    const controller = new AbortController();
    const pending = fetch(
      `http://127.0.0.1:${String(address.port)}/api/v1/connections/${connectionId}/tables/orders/scan`,
      {
        method: "POST",
        headers: {
          cookie: open.cookie,
          [CSRF_HEADER]: open.csrf,
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: 50, fillPage: true }),
        signal: controller.signal,
      },
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(scans).toBe(1);
    await app.close();
  });
});
