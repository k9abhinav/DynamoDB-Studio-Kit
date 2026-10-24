import { describe, expect, it } from "vitest";
import {
  AttributeValue,
  BoundedAttributeValue,
  Item,
  isDynamoNumber,
  nestingDepth,
} from "./attribute.js";

const digits = "9".repeat(38);

describe("isDynamoNumber", () => {
  it("keeps a 38-digit value and scientific notation as text", () => {
    expect(isDynamoNumber(digits)).toBe(true);
    expect(isDynamoNumber("1E+2")).toBe(true);
    expect(isDynamoNumber("1e-130")).toBe(true);
    expect(isDynamoNumber("0")).toBe(true);
    expect(isDynamoNumber(".5")).toBe(true);
  });

  it("rejects values DynamoDB cannot store", () => {
    expect(isDynamoNumber("9".repeat(39))).toBe(false);
    expect(isDynamoNumber("1E+126")).toBe(false);
    expect(isDynamoNumber("1E-131")).toBe(false);
    expect(isDynamoNumber("1E")).toBe(false);
    expect(isDynamoNumber("NaN")).toBe(false);
    expect(isDynamoNumber("")).toBe(false);
  });
});

describe("AttributeValue", () => {
  it("accepts every DynamoDB type and rejects unknown keys", () => {
    expect(AttributeValue.parse({ S: "" })).toEqual({ S: "" });
    expect(AttributeValue.parse({ N: digits })).toEqual({ N: digits });
    expect(AttributeValue.parse({ N: "1E+2" })).toEqual({ N: "1E+2" });
    expect(AttributeValue.parse({ B: "QUI=" })).toEqual({ B: "QUI=" });
    expect(AttributeValue.parse({ BOOL: false })).toEqual({ BOOL: false });
    expect(AttributeValue.parse({ NULL: true })).toEqual({ NULL: true });
    expect(AttributeValue.parse({ L: [{ S: "a" }] })).toEqual({ L: [{ S: "a" }] });
    expect(AttributeValue.parse({ M: { city: { S: "Pune" } } })).toEqual({
      M: { city: { S: "Pune" } },
    });
    expect(AttributeValue.parse({ SS: ["alpha", "beta"] })).toEqual({ SS: ["alpha", "beta"] });
    expect(AttributeValue.parse({ NS: ["1", "2.5"] })).toEqual({ NS: ["1", "2.5"] });
    expect(AttributeValue.parse({ BS: ["QUI="] })).toEqual({ BS: ["QUI="] });
    expect(() => AttributeValue.parse({ S: "a", N: "1" })).toThrow();
    expect(() => AttributeValue.parse({ NULL: false })).toThrow();
    expect(() => AttributeValue.parse({ SS: [] })).toThrow();
    expect(() => AttributeValue.parse({ SS: ["a", "a"] })).toThrow(/unique/);
    expect(() => AttributeValue.parse({ N: "9".repeat(39) })).toThrow();
  });

  it("rejects values nested more than 32 levels", () => {
    let value: AttributeValue = { S: "leaf" };
    for (let level = 0; level < 31; level += 1) {
      value = { M: { child: value } };
    }
    expect(nestingDepth(value)).toBe(32);
    expect(BoundedAttributeValue.parse(value)).toEqual(value);
    const tooDeep = { M: { child: value } };
    expect(nestingDepth(tooDeep)).toBe(33);
    expect(() => BoundedAttributeValue.parse(tooDeep)).toThrow(/32 levels/);
  });

  it("parses an item whose attribute is a 38-digit number", () => {
    const item = Item.parse({ id: { S: "number-38" }, digits: { N: digits } });
    expect(item.digits).toEqual({ N: digits });
  });
});
