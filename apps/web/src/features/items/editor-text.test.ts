import { describe, expect, it } from "vitest";
import { formatItem, readEditorDocument } from "./editor-text.js";

const digits = "12345678901234567890123456789012345678";

describe("editor text", () => {
  it("formats plain JSON without turning 1E+2 into 100", () => {
    const text = formatItem({ id: { S: "a" }, n: { N: "1E+2" }, big: { N: digits } }, "plain");
    expect(text).toContain("1E+2");
    expect(text).not.toContain("100");
    expect(text).toContain(digits);
    const read = readEditorDocument(text, "plain", { keys: [{ name: "id", type: "S" }] });
    expect(read.item).toEqual({ id: { S: "a" }, n: { N: "1E+2" }, big: { N: digits } });
  });

  it("blocks a changed key and an empty set", () => {
    const changed = readEditorDocument(
      formatItem({ id: { S: "b" }, email: { S: "a@b.c" } }, "plain"),
      "plain",
      {
        keys: [{ name: "id", type: "S" }],
        original: { id: { S: "a" }, email: { S: "old@b.c" } },
      },
    );
    expect(changed.item).toBeNull();
    expect(changed.issues.map((issue) => issue.message).join(" ")).toMatch(/cannot change/);
    const empty = readEditorDocument(
      formatItem({ id: { S: "a" }, tags: { SS: [] } }, "plain"),
      "plain",
    );
    expect(empty.issues.map((issue) => issue.message).join(" ")).toMatch(/empty/i);
  });

  it("points a syntax error at a line", () => {
    const read = readEditorDocument("{\n", "plain");
    expect(read.item).toBeNull();
    expect(read.issues[0]?.line).toBeGreaterThan(0);
  });
});
