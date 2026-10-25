import { describe, expect, it } from "vitest";
import {
  ITEM_SIZE_LIMIT,
  ITEM_SIZE_WARN,
  estimateItemSize,
  extractKey,
  itemHash,
  validateTypedItem,
  type Item,
} from "./index.js";

const digits = "12345678901234567890123456789012345678";
const keys = [{ name: "id", type: "S" as const }];

function messages(item: Item, options?: Parameters<typeof validateTypedItem>[1]): string {
  return validateTypedItem(item, options)
    .map((issue) => issue.message)
    .join(" ");
}

describe("validateTypedItem", () => {
  it("accepts the 38-digit number and a 390 KB string", () => {
    const large: Item = { id: { S: "large" }, blob: { S: "a".repeat(390_000) } };
    expect(estimateItemSize(large)).toBeLessThan(ITEM_SIZE_LIMIT);
    expect(
      validateTypedItem(large, { keys }).filter((issue) => issue.severity === "error"),
    ).toEqual([]);
    expect(validateTypedItem({ n: { N: digits } })).toEqual([]);
  });

  it("blocks empty sets, duplicate members, bad numbers, bad binary, and deep nesting", () => {
    expect(messages({ tags: { SS: [] } })).toMatch(/empty/i);
    expect(messages({ tags: { SS: ["a", "a"] } })).toMatch(/unique/i);
    expect(messages({ n: { N: "nope" } })).toMatch(/number/i);
    expect(messages({ b: { B: "!!!!" } })).toMatch(/base64/i);
    let nested: Item = { id: { S: "leaf" } };
    for (let depth = 0; depth < 33; depth += 1) {
      nested = { child: { M: nested } };
    }
    expect(messages(nested)).toMatch(/32/);
  });

  it("blocks a missing, mistyped, empty, or changed key", () => {
    expect(messages({ email: { S: "a@b.c" } }, { keys })).toMatch(/Key id is missing/);
    expect(messages({ id: { N: "1" } }, { keys })).toMatch(/Key id must be a string/);
    expect(messages({ id: { S: "" } }, { keys })).toMatch(/Key id cannot be empty/);
    const changed = messages(
      { id: { S: "b" }, email: { S: "next@b.c" } },
      { keys, original: { id: { S: "a" }, email: { S: "old@b.c" } } },
    );
    expect(changed).toMatch(/The key id cannot change/);
    expect(changed).not.toMatch(/email/);
  });

  it("warns at 350 KB and blocks above 400 KB", () => {
    const warned: Item = { blob: { S: "a".repeat(ITEM_SIZE_WARN) } };
    expect(estimateItemSize(warned)).toBeGreaterThanOrEqual(ITEM_SIZE_WARN);
    expect(validateTypedItem(warned).some((issue) => issue.severity === "warning")).toBe(true);
    const blocked: Item = { blob: { S: "a".repeat(ITEM_SIZE_LIMIT) } };
    expect(estimateItemSize(blocked)).toBeGreaterThan(ITEM_SIZE_LIMIT);
    expect(messages(blocked)).toMatch(/400 KB/);
  });
});

describe("itemHash", () => {
  it("hashes canonical text so 1E+2 stays distinct from 100", async () => {
    const first = await itemHash({ b: { S: "1" }, a: { N: "1E+2" }, n: { N: digits } });
    const reordered = await itemHash({ n: { N: digits }, a: { N: "1E+2" }, b: { S: "1" } });
    const rounded = await itemHash({ b: { S: "1" }, a: { N: "100" }, n: { N: digits } });
    expect(first).toBe(reordered);
    expect(first).not.toBe(rounded);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(extractKey({ id: { S: "a" }, email: { S: "a@b.c" } }, keys)).toEqual({ id: { S: "a" } });
  });
});
