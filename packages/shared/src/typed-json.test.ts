import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AttributeValue, Item } from "./api/attribute.js";
import {
  canonicalTypedJson,
  fromPlain,
  fromPlainItem,
  parsePlain,
  stringifyPlain,
  toPlainItem,
} from "./typed-json.js";

const digits = "12345678901234567890123456789012345678";

const fixtures: readonly Item[] = [
  { id: { S: "number-38" }, digits: { N: digits } },
  { id: { S: "exponent" }, value: { N: "1E+2" } },
  { id: { S: "padded" }, value: { N: "12.50" } },
  { id: { S: "negzero" }, value: { N: "-0" } },
  { id: { S: "address-pune" }, address: { M: { city: { S: "Pune" } } } },
  {
    id: { S: "sets" },
    labels: { SS: ["alpha", "beta"] },
    scores: { NS: ["1", "2.5", "1E+2"] },
    blobs: { BS: ["aGk="] },
  },
  { id: { S: "binary" }, payload: { B: "aGVsbG8=" } },
  { id: { S: "bool" }, active: { BOOL: false } },
  { id: { S: "null" }, note: { NULL: true } },
  { id: { S: "list" }, tags: { L: [{ S: "a" }, { N: "1" }, { NULL: true }] } },
  { id: { S: "empty-string" }, note: { S: "" } },
  { id: { S: "unicode" }, greeting: { S: "こんにちは 😀" } },
  {
    id: { S: "dollar" },
    doc: {
      M: {
        $b: { S: "not-binary" },
        $$b: { N: "1" },
        $ss: { L: [{ S: "a" }] },
      },
    },
  },
  { $b: { S: "attribute" }, id: { S: "key-dollar" } },
];

describe("typed JSON plain projection", () => {
  it("round-trips edge fixtures through text without changing digits", () => {
    for (const item of fixtures) {
      const text = stringifyPlain(toPlainItem(item));
      expect(fromPlainItem(parsePlain(text))).toEqual(item);
      expect(fromPlainItem(toPlainItem(item))).toEqual(item);
    }
    const exponent = stringifyPlain(toPlainItem({ value: { N: "1E+2" } }));
    expect(exponent).toContain("1E+2");
    expect(exponent).not.toContain("100");
    const wide = stringifyPlain(toPlainItem({ digits: { N: digits } }));
    expect(wide).toContain(digits);
  });

  it("escapes map keys that would look like wrappers", () => {
    const plain = toPlainItem({
      doc: { M: { $b: { S: "x" }, $$already: { S: "y" } } },
    });
    expect(plain.doc).toEqual({ $$b: "x", $$$already: "y" });
  });

  it("rejects a JavaScript number so digits cannot be rounded", () => {
    expect(() => fromPlain(1)).toThrow(/decimal string/);
  });

  it("canonical typed JSON sorts keys and keeps number text", () => {
    const first = {
      b: { S: "1" },
      a: { N: "1E+2" },
      m: { M: { z: { S: "z" }, a: { N: digits } } },
    };
    const second = {
      m: { M: { a: { N: digits }, z: { S: "z" } } },
      a: { N: "1E+2" },
      b: { S: "1" },
    };
    expect(canonicalTypedJson(first)).toBe(canonicalTypedJson(second));
    expect(canonicalTypedJson(first)).toBe(
      `{"a":{"N":"1E+2"},"b":{"S":"1"},"m":{"M":{"a":{"N":"${digits}"},"z":{"S":"z"}}}}`,
    );
  });

  it("round-trips generated items, including a text parse", () => {
    const numberArb = fc.constantFrom("0", "-0", "1E+2", "12.50", digits, "2.5");
    const nameArb = fc
      .oneof(
        fc.constantFrom("$b", "$ss", "$$b", "city", "名前"),
        fc.string({ minLength: 1, maxLength: 8, unit: "grapheme-ascii" }),
      )
      .filter((name) => name.length > 0);
    const attributeArb = (depth: number): fc.Arbitrary<AttributeValue> => {
      const leaf = fc.oneof(
        fc.string({ maxLength: 12 }).map((value): AttributeValue => ({ S: value })),
        numberArb.map((value): AttributeValue => ({ N: value })),
        fc.constantFrom<AttributeValue>({ B: "QUI=" }, { B: "aGk=" }),
        fc.boolean().map((value): AttributeValue => ({ BOOL: value })),
        fc.constant<AttributeValue>({ NULL: true }),
        fc
          .uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 3 })
          .map((value): AttributeValue => ({ SS: value })),
        fc
          .uniqueArray(numberArb, { minLength: 1, maxLength: 3 })
          .map((value): AttributeValue => ({ NS: value })),
        fc
          .uniqueArray(fc.constantFrom("QUI=", "aGk="), { minLength: 1, maxLength: 2 })
          .map((value): AttributeValue => ({ BS: value })),
      );
      if (depth === 0) {
        return leaf;
      }
      return fc.oneof(
        leaf,
        fc
          .array(attributeArb(depth - 1), { maxLength: 2 })
          .map((value): AttributeValue => ({ L: value })),
        fc
          .dictionary(nameArb, attributeArb(depth - 1), { maxKeys: 2 })
          .map((value): AttributeValue => ({ M: value })),
      );
    };
    fc.assert(
      fc.property(fc.dictionary(nameArb, attributeArb(2), { minKeys: 1, maxKeys: 3 }), (item) => {
        expect(fromPlainItem(toPlainItem(item))).toEqual(item);
        expect(fromPlainItem(parsePlain(stringifyPlain(toPlainItem(item))))).toEqual(item);
        const reversed = Object.fromEntries(Object.entries(item).reverse());
        expect(canonicalTypedJson(reversed)).toBe(canonicalTypedJson(item));
      }),
      { numRuns: 1000 },
    );
  });
});
