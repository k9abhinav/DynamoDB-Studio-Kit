import { describe, expect, it } from "vitest";
import { PatchProfileBody, ProfileSummary } from "./profile.js";

describe("profiles", () => {
  it("accepts a summary without secrets and rejects a secret field", () => {
    const summary = {
      id: "p1",
      name: "Local dev",
      endpoint: "http://localhost:8000",
      region: "us-east-1",
      env: "local",
      readOnly: false,
      authType: "local",
      lastUsedAt: "2026-10-23T12:00:00.000Z",
      hasSecret: false,
    };
    expect(ProfileSummary.parse(summary)).toEqual(summary);
    expect(ProfileSummary.safeParse({ ...summary, secretAccessKey: "secret" }).success).toBe(false);
  });

  it("keeps an omitted auth as no change and requires a field", () => {
    expect(PatchProfileBody.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
    expect(PatchProfileBody.safeParse({}).success).toBe(false);
    expect(PatchProfileBody.safeParse({ endpoint: "" }).success).toBe(true);
  });
});
