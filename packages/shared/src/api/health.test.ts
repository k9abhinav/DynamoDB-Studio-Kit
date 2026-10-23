import { describe, expect, it } from "vitest";
import { HealthResponse } from "./health.js";

describe("HealthResponse", () => {
  it("accepts a successful health payload", () => {
    expect(HealthResponse.parse({ ok: true, version: "0.0.0" })).toEqual({
      ok: true,
      version: "0.0.0",
    });
  });

  it("rejects extra keys", () => {
    expect(HealthResponse.safeParse({ ok: true, version: "0.0.0", extra: true }).success).toBe(
      false,
    );
  });

  it("rejects ok: false", () => {
    expect(HealthResponse.safeParse({ ok: false, version: "0.0.0" }).success).toBe(false);
  });
});
