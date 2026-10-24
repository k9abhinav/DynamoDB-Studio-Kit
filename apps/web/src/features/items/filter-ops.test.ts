import { describe, expect, it } from "vitest";
import { compileFilter, operatorsFor, valueKind } from "./filter-ops.js";

const digits = "12345678901234567890123456789012345678";

describe("filter operators", () => {
  it("keeps a 38-digit number as a decimal string", () => {
    const compiled = compileFilter({
      attribute: "digits",
      op: "=",
      kind: "N",
      raw: digits,
      raw2: "",
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.filter.value).toEqual({ N: digits });
    expect(typeof compiled.filter.value).not.toBe("number");
    expect(operatorsFor("N")).not.toContain("begins_with");
    expect(operatorsFor("N")).not.toContain("contains");
    expect(operatorsFor("S")).toContain("begins_with");
    expect(operatorsFor("BOOL")).toEqual(["="]);
    expect(operatorsFor("DOC")).toEqual(["exists", "not_exists", "type_is"]);
    expect(valueKind({ N: "1" })).toBe("N");
    expect(valueKind({ M: { city: { S: "Pune" } } })).toBe("DOC");
  });
});
