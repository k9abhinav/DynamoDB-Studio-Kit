import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { CSRF_HEADER, SESSION_COOKIE, SESSION_IDLE_MS } from "@dynamo-studio/shared";
import { buildApp } from "../app.js";

function setCookie(header: string | string[] | undefined): string {
  const line = Array.isArray(header) ? header[0] : header;
  if (line === undefined) {
    throw new Error("missing set-cookie");
  }
  return line;
}

async function sessionOf(app: Awaited<ReturnType<typeof buildApp>>): Promise<{
  cookie: string;
  csrf: string;
  setCookie: string;
}> {
  const response = await app.inject({ method: "GET", url: "/api/v1/session" });
  expect(response.statusCode).toBe(200);
  const header = setCookie(response.headers["set-cookie"]);
  const pair = header.split(";")[0] ?? header;
  return {
    cookie: pair,
    csrf: response.json<{ csrfToken: string }>().csrfToken,
    setCookie: header,
  };
}

describe("session security", () => {
  it("sets an httpOnly SameSite=Strict cookie and echoes the request id", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/session" });
    const header = setCookie(response.headers["set-cookie"]);
    expect(header).toContain(`${SESSION_COOKIE}=`);
    expect(header).toContain("HttpOnly");
    expect(header.toLowerCase()).toContain("samesite=strict");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({ version: "0.0.0" });
    await app.close();
  });

  it("rejects a missing CSRF token, a bad origin, and a rebinding host", async () => {
    const app = await buildApp();
    app.post("/api/v1/echo", () => ({ ok: true }));
    const session = await sessionOf(app);

    const missing = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: { cookie: session.cookie },
      payload: {},
    });
    expect(missing.statusCode).toBe(401);
    expect(missing.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });

    const origin = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: {
        cookie: session.cookie,
        [CSRF_HEADER]: session.csrf,
        origin: "http://evil.example",
      },
      payload: {},
    });
    expect(origin.statusCode).toBe(403);
    expect(origin.json()).toMatchObject({ error: { code: "FORBIDDEN_ORIGIN" } });

    const host = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: {
        cookie: session.cookie,
        [CSRF_HEADER]: session.csrf,
        origin: "http://127.0.0.1:5173",
        host: "rebinding.example",
      },
      payload: {},
    });
    expect(host.statusCode).toBe(403);
    expect(host.json()).toMatchObject({ error: { code: "FORBIDDEN_ORIGIN" } });

    const ok = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: {
        cookie: session.cookie,
        [CSRF_HEADER]: session.csrf,
        origin: "http://127.0.0.1:5173",
      },
      payload: {},
    });
    expect(ok.statusCode).toBe(200);
    await app.close();
  });

  it("expires an idle session", async () => {
    let clock = 5_000;
    const app = await buildApp({ now: () => clock });
    app.post("/api/v1/echo", () => ({ ok: true }));
    const session = await sessionOf(app);
    clock += SESSION_IDLE_MS + 1;
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: { code: "UNAUTHENTICATED", message: "Session expired. Reconnect." },
    });
    await app.close();
  });

  it("does not echo secret values from a validation error", async () => {
    const app = await buildApp();
    const Secret = z.strictObject({ secretAccessKey: z.string().min(20) });
    app.post("/api/v1/echo", (request) => {
      Secret.parse(request.body);
      return { ok: true };
    });
    const session = await sessionOf(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
      payload: { secretAccessKey: "super-secret-value", extra: true },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain("super-secret-value");
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION" } });
    await app.close();
  });

  it("rejects an oversized body without the default Fastify HTML error", async () => {
    const app = await buildApp({ bodyLimit: 32 });
    app.post("/api/v1/echo", () => ({ ok: true }));
    const session = await sessionOf(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/echo",
      headers: { cookie: session.cookie, [CSRF_HEADER]: session.csrf },
      payload: { value: "this payload is definitely over thirty two bytes" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "LIMIT_EXCEEDED" } });
    await app.close();
  });

  it("serves the built web app and keeps unknown API routes as JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "ds-static-"));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "index.html"), "<p>DynamoDB Studio</p>");
    await writeFile(join(root, "assets", "app.js"), "console.log(1)");
    const app = await buildApp({ staticRoot: root });
    const session = await sessionOf(app);
    const page = await app.inject({ method: "GET", url: "/" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("DynamoDB Studio");
    const asset = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(asset.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    const spa = await app.inject({ method: "GET", url: "/c/abc" });
    expect(spa.statusCode).toBe(200);
    expect(spa.body).toContain("DynamoDB Studio");
    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/missing",
      headers: { cookie: session.cookie },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
    await app.close();
  });
});
