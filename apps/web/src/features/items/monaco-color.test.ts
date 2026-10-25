import { describe, expect, it } from "vitest";
import { monacoColor } from "./monaco-color.js";

describe("monacoColor", () => {
  it("expands a three-digit hex and keeps a six-digit hex", () => {
    expect(monacoColor("#fff")).toBe("#ffffff");
    expect(monacoColor(" #202124 ")).toBe("#202124");
    expect(monacoColor("#e8eaedcc")).toBe("#e8eaedcc");
  });

  it("drops colors Monaco will not parse", () => {
    expect(monacoColor("rgb(255, 255, 255)")).toBeUndefined();
    expect(monacoColor("")).toBeUndefined();
  });
});
