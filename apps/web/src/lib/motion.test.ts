import { describe, expect, it } from "vitest";
import { motionTransition } from "./motion.js";

describe("motionTransition", () => {
  it("keeps color and transform motion when reduced motion is off", () => {
    const value = motionTransition(false, "layer");
    expect(value).toContain("background-color 200ms");
    expect(value).toContain("transform 200ms");
  });

  it("uses only an opacity transition when reduced motion is requested", () => {
    expect(motionTransition(true, "hover")).toBe("opacity 150ms");
    expect(motionTransition(true, "route")).toBe("opacity 250ms");
    expect(motionTransition(true, "layer")).not.toContain("transform");
  });
});
