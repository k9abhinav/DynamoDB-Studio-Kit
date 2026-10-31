import { describe, expect, it } from "vitest";
import { nodeStartupNotice, nodeSupportWarning, nodeVersionMessage } from "./node-version.js";

describe("nodeStartupNotice", () => {
  it("starts quietly on Node 22", () => {
    expect(nodeStartupNotice("22.14.0")).toBeUndefined();
  });

  it("refuses a major older than 22", () => {
    expect(() => nodeStartupNotice("20.18.1")).toThrow(nodeVersionMessage("20.18.1"));
    expect(() => nodeStartupNotice("21.7.0")).toThrow(/requires Node.js 22 or newer/);
  });

  it("warns and continues on a newer major", () => {
    expect(nodeStartupNotice("26.4.0")).toBe(nodeSupportWarning("26.4.0"));
  });
});
