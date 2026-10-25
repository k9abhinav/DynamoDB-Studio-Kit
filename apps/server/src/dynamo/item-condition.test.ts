import { describe, expect, it } from "vitest";
import { buildWriteCondition } from "./item-condition.js";

describe("buildWriteCondition", () => {
  it("requires every key to be absent when creating", () => {
    const built = buildWriteCondition({
      mode: "create",
      keys: [{ name: "id" }, { name: 'sk" OR' }],
      equality: false,
    });
    expect(built.expression).toBe("attribute_not_exists(#n0) AND attribute_not_exists(#n1)");
    expect(built.names["#n1"]).toBe('sk" OR');
    expect(built.expression).not.toContain("OR");
    expect(built.values).toEqual({});
    expect(built.weak).toBe(false);
  });

  it("compares each saved attribute when the item is small", () => {
    const built = buildWriteCondition({
      mode: "replace",
      keys: [{ name: "id" }],
      previous: { id: { S: "a" }, email: { S: "a@b.c" }, n: { N: "1E+2" } },
      equality: true,
    });
    expect(built.expression.startsWith("attribute_exists(#n0)")).toBe(true);
    expect(built.expression).toContain("#n2 = :v1");
    expect(built.values[":v2"]).toEqual({ N: "1E+2" });
    expect(built.weak).toBe(false);
  });

  it("keeps only the existence check when equality is skipped or the expression is too long", () => {
    const skipped = buildWriteCondition({
      mode: "replace",
      keys: [{ name: "id" }],
      previous: { id: { S: "a" } },
      equality: false,
    });
    expect(skipped.expression).toBe("attribute_exists(#n0)");
    expect(skipped.weak).toBe(true);

    const previous: Record<string, { S: string }> = {};
    for (let index = 0; index < 200; index += 1) {
      previous[`attribute-${"x".repeat(40)}-${String(index)}`] = { S: "y" };
    }
    const long = buildWriteCondition({
      mode: "replace",
      keys: [{ name: "id" }],
      previous,
      equality: true,
    });
    expect(long.expression).toBe("attribute_exists(#n0)");
    expect(long.values).toEqual({});
    expect(long.weak).toBe(true);
  });
});
