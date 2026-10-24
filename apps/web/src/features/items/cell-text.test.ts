import { describe, expect, it } from "vitest";
import { compareAttributes, presentCell } from "./cell-text.js";

const digits = "12345678901234567890123456789012345678";

describe("presentCell", () => {
  it("distinguishes missing, null, and empty string", () => {
    expect(presentCell(undefined).label).toBe("Missing");
    expect(presentCell(undefined).text).toBe("");
    expect(presentCell({ NULL: true })).toMatchObject({ text: "null", muted: true, label: "Null" });
    expect(presentCell({ S: "" })).toMatchObject({ text: "", label: "Empty string" });
  });

  it("keeps numbers exact and truncates long strings", () => {
    expect(presentCell({ N: digits }).text).toBe(digits);
    expect(presentCell({ N: "1E+2" }).text).toBe("1E+2");
    expect(presentCell({ N: digits }).align).toBe("right");
    const long = "a".repeat(800);
    expect(presentCell({ S: long }).text.length).toBeLessThanOrEqual(501);
    expect(presentCell({ S: long }).title?.length).toBeLessThanOrEqual(301);
  });

  it("renders every other DynamoDB type", () => {
    expect(presentCell({ BOOL: false }).text).toBe("false");
    expect(presentCell({ B: "aGVsbG8=" }).text).toBe("<binary 5 B>");
    expect(presentCell({ SS: ["a", "b", "c"] }).text).toBe("SS(3)");
    expect(presentCell({ NS: ["1", "2.5"] }).text).toBe("NS(2)");
    expect(presentCell({ BS: ["QQ=="] }).text).toBe("BS(1)");
    expect(presentCell({ L: [{ S: "a" }, { N: "1" }] }).text).toBe("[2 items]");
    expect(presentCell({ M: { city: { S: "Pune" } } }).text).toBe("{1 keys}");
    expect(presentCell({ M: { city: { S: "Pune" } } }).title).toContain("Pune");
  });
});

describe("compareAttributes", () => {
  it("orders numbers without converting a 38-digit value", () => {
    expect(compareAttributes({ N: "9" }, { N: digits })).toBeLessThan(0);
    expect(compareAttributes({ N: "1E+2" }, { N: "100" })).toBe(0);
    expect(compareAttributes({ N: digits }, { N: `${digits}9` })).not.toBe(0);
    expect(compareAttributes(undefined, { NULL: true })).toBeGreaterThan(0);
    expect(compareAttributes({ NULL: true }, { S: "" })).toBeGreaterThan(0);
  });
});
