import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { CSRF_HEADER, MAX_CONNECTIONS_PER_SESSION, SESSION_IDLE_MS } from "@dynamo-studio/shared";
import { buildApp } from "../app.js";
import type { DynamoCaller } from "../services/credentials.js";

function cookieOf(header: string | string[] | undefined): string {
  const line = Array.isArray(header) ? header[0] : header;
  if (line === undefined) {
    throw new Error("missing set-cookie");
  }
  return line.split(";")[0] ?? line;
}

async function openSession(app: Awaited<ReturnType<typeof buildApp>>): Promise<{
  cookie: string;
  csrf: string;
}> {
  const response = await app.inject({ method: "GET", url: "/api/v1/session" });
  return {
    cookie: cookieOf(response.headers["set-cookie"]),
    csrf: response.json<{ csrfToken: string }>().csrfToken,
  };
}

function fakeClient(destroyed: string[]): DynamoCaller {
  return {
    destroy() {
      destroyed.push("destroy");
    },
    send: () => Promise.resolve({ TableNames: ["users"] }),
  };
}

const createBody = {
  endpoint: "http://127.0.0.1:8000",
  region: "us-east-1",
  auth: { type: "local" },
  env: "local",
  readOnly: false,
  remember: false,
};

describe("connections", () => {
  it("destroys the client on delete and when the session expires", async () => {
    const destroyed: string[] = [];
    let clock = 1_000;
    const app = await buildApp({
      now: () => clock,
      createClient: () => fakeClient(destroyed),
    });
    const session = await openSession(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/connections",
      headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
      payload: createBody,
    });
    expect(created.statusCode).toBe(201);
    const id = created.json<{ connectionId: string }>().connectionId;
    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/connections/${id}`,
      headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
    });
    expect(removed.statusCode).toBe(204);
    expect(destroyed).toEqual(["destroy"]);

    await app.inject({
      method: "POST",
      url: "/api/v1/connections",
      headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
      payload: createBody,
    });
    clock += SESSION_IDLE_MS + 1;
    const expired = await app.inject({
      method: "GET",
      url: "/api/v1/connections",
      headers: { cookie: session.cookie },
    });
    expect(expired.statusCode).toBe(401);
    expect(destroyed).toEqual(["destroy", "destroy"]);
    await app.close();
  });

  it("stops at 10 connections in one session", async () => {
    const app = await buildApp({ createClient: () => fakeClient([]) });
    const session = await openSession(app);
    for (let index = 0; index < MAX_CONNECTIONS_PER_SESSION; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/connections",
        headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
        payload: createBody,
      });
      expect(response.statusCode).toBe(201);
    }
    const extra = await app.inject({
      method: "POST",
      url: "/api/v1/connections",
      headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
      payload: createBody,
    });
    expect(extra.statusCode).toBe(400);
    expect(extra.json()).toMatchObject({ error: { code: "LIMIT_EXCEEDED" } });
    await app.close();
  });

  it("does not rate limit the heartbeat", async () => {
    const app = await buildApp({ createClient: () => fakeClient([]) });
    const session = await openSession(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/connections",
      headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
      payload: createBody,
    });
    const id = created.json<{ connectionId: string }>().connectionId;
    for (let index = 0; index < 31; index += 1) {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${id}`,
        headers: { cookie: session.cookie },
      });
      expect(response.statusCode).toBe(200);
    }
    await app.close();
  });

  it("hides secrets in connect logs and responses", async () => {
    const chunks: string[] = [];
    const destination = new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
        callback();
      },
    });
    const app = await buildApp({ logger: { level: "info", destination } });
    const session = await openSession(app);
    const headers = {
      cookie: session.cookie,
      [CSRF_HEADER]: session.csrf,
      authorization: "Bearer auth-header-value",
    };
    const payload = {
      endpoint: "http://127.0.0.1:9",
      region: "us-east-1",
      auth: {
        type: "keys",
        accessKeyId: "AKIAtest",
        secretAccessKey: "super-secret-value",
        sessionToken: "session-token-value",
      },
    };
    const failed = await app.inject({
      method: "POST",
      url: "/api/v1/connections/test",
      headers,
      payload,
    });
    expect(failed.statusCode).toBe(502);
    expect(failed.body).not.toContain("super-secret-value");
    expect(failed.body).not.toContain("session-token-value");
    expect(failed.body).not.toContain("secretAccessKey");
    expect(failed.body).not.toContain("sessionToken");
    const logs = chunks.join("");
    expect(logs).not.toContain("super-secret-value");
    expect(logs).not.toContain("session-token-value");
    expect(logs).not.toContain("auth-header-value");
    expect(logs).not.toContain("secretAccessKey");
    expect(logs).not.toContain("sessionToken");
    expect(logs).not.toContain("Authorization");
    await app.close();
  });

  it("rate limits connection attempts", async () => {
    const app = await buildApp({
      createClient: () => ({
        destroy() {
          return undefined;
        },
        send: () => Promise.reject(Object.assign(new Error("down"), { code: "ECONNREFUSED" })),
      }),
    });
    const session = await openSession(app);
    const headers = { cookie: session.cookie, [CSRF_HEADER]: session.csrf };
    const payload = {
      endpoint: "http://127.0.0.1:9",
      region: "us-east-1",
      auth: { type: "local" },
    };
    for (let index = 0; index < 30; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/connections/test",
        headers,
        payload,
      });
      expect(response.statusCode).toBe(502);
    }
    const limited = await app.inject({
      method: "POST",
      url: "/api/v1/connections/test",
      headers,
      payload,
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: "THROTTLED" } });
    await app.close();
  });
});
