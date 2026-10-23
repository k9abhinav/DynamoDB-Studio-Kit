import { describe, expect, it } from "vitest";
import { HEARTBEAT_MS, heartbeatInterval } from "./use-live-connection.js";

describe("heartbeatInterval", () => {
  it("pauses while the tab is hidden", () => {
    expect(heartbeatInterval("visible")).toBe(HEARTBEAT_MS);
    expect(heartbeatInterval("hidden")).toBe(false);
  });
});
