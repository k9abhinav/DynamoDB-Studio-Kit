import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fetchHealth } from "./fetch-health.js";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("fetchHealth", () => {
  it("parses the shared health response", async () => {
    server.use(
      http.get("*/api/v1/health", () => HttpResponse.json({ ok: true, version: "0.0.0" })),
    );
    await expect(fetchHealth()).resolves.toEqual({ ok: true, version: "0.0.0" });
  });

  it("rejects a failed response", async () => {
    server.use(http.get("*/api/v1/health", () => new HttpResponse(null, { status: 500 })));
    await expect(fetchHealth()).rejects.toThrow("Health check failed (500)");
  });
});
