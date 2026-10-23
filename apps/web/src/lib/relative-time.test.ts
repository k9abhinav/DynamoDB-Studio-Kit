import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time.js";

describe("relativeTime", () => {
  it("formats a recent timestamp", () => {
    const now = Date.parse("2026-10-23T12:00:00.000Z");
    expect(relativeTime("2026-10-23T11:58:00.000Z", now)).toMatch(/minute/);
  });
});
