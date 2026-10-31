import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("GET /api/v1/health", () => {
  it("returns the shared health schema", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, version: "1.0.0-rc.1" });
    await app.close();
  });
});
