import { describe, expect, it } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";
import { buildApp } from "../app.js";

function fakeClient() {
  return {
    destroy() {
      return undefined;
    },
    send: () => Promise.resolve({ TableNames: [] }),
  };
}

async function session(app: Awaited<ReturnType<typeof buildApp>>): Promise<{
  cookie: string;
  csrf: string;
}> {
  const response = await app.inject({ method: "GET", url: "/api/v1/session" });
  const header = response.headers["set-cookie"];
  const line = Array.isArray(header) ? header[0] : header;
  return {
    cookie: line?.split(";")[0] ?? "",
    csrf: response.json<{ csrfToken: string }>().csrfToken,
  };
}

describe("read-only guard", () => {
  it("returns 404 for the probe route when probes are disabled", async () => {
    const app = await buildApp({ enableProbe: false, createClient: fakeClient });
    const open = await session(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/connections/missing/mutations/probe",
      headers: { cookie: open.cookie, [CSRF_HEADER]: open.csrf },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("rejects a read-only connection until PATCH turns it off", async () => {
    const app = await buildApp({ createClient: fakeClient });
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
    const id = created.json<{ connectionId: string }>().connectionId;
    const blocked = await app.inject({
      method: "POST",
      url: `/api/v1/connections/${id}/mutations/probe`,
      headers,
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json()).toMatchObject({ error: { code: "READ_ONLY" } });

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/v1/connections/${id}`,
      headers,
      payload: { readOnly: false },
    });
    expect(patched.json<{ summary: { readOnly: boolean } }>().summary.readOnly).toBe(false);
    const allowed = await app.inject({
      method: "POST",
      url: `/api/v1/connections/${id}/mutations/probe`,
      headers,
    });
    expect(allowed.statusCode).toBe(204);
    await app.close();
  });
});
