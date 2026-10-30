import { describe, expect, it } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";
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

describe("export against DynamoDB Local", () => {
  it("exports all 10,000 orders as NDJSON plus a summary line", async () => {
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
      const exported = await app.inject({
        method: "POST",
        url: `/api/v1/connections/${connectionId}/tables/orders/export`,
        headers,
        payload: { format: "ndjson", typed: true, scope: "all" },
      });
      expect(exported.statusCode).toBe(200);
      expect(exported.headers["content-type"]).toContain("application/x-ndjson");
      const lines = exported.body.split("\n").filter((line) => line.length > 0);
      const summary = JSON.parse(lines.at(-1) ?? "{}") as { __summary?: { items?: number } };
      expect(summary.__summary?.items).toBe(10_000);
      expect(lines).toHaveLength(10_001);
    } finally {
      await app.close();
    }
  });
});
