import { type AttributeValue, type Filter, type FilterOp } from "@dynamo-studio/shared";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { HttpError } from "../http-error.js";
import { buildFilterExpression, buildProjectionExpression } from "./expression-builder.js";

const DIGITS = "12345678901234567890123456789012345678";

function assertPlaceholdersOnly(expression: string): void {
  const allowed =
    /#n\d+|:v\d+|\[\d+\]|attribute_not_exists|attribute_exists|attribute_type|begins_with|contains|BETWEEN|AND|OR|NOT|IN|<>|<=|>=|<|>|=|\(|\)|,|\.|\s/g;
  expect(expression.replace(allowed, "")).toBe("");
}

function expectBuilt(
  filters: readonly Filter[],
  joiner: "and" | "or",
  expression: string,
  names: Record<string, string>,
  values: Record<string, AttributeValue>,
): void {
  const built = buildFilterExpression(filters, joiner);
  expect(built).toEqual({ expression, names, values });
  if (built === undefined) {
    throw new Error("expected an expression");
  }
  assertPlaceholdersOnly(built.expression);
  const nameRefs = built.expression.match(/#n\d+/g) ?? [];
  const valueRefs = built.expression.match(/:v\d+/g) ?? [];
  expect(new Set(nameRefs)).toEqual(new Set(Object.keys(built.names)));
  expect(new Set(valueRefs)).toEqual(new Set(Object.keys(built.values)));
  for (const name of Object.values(built.names)) {
    expect(withoutOperators(built.expression).includes(name)).toBe(false);
  }
}

function withoutOperators(expression: string): string {
  return expression.replace(
    /attribute_not_exists|attribute_exists|attribute_type|begins_with|contains|BETWEEN|AND|OR|NOT|IN/g,
    "",
  );
}

function expectInvalid(run: () => unknown, message: RegExp): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(HttpError);
  if (!(caught instanceof HttpError)) {
    return;
  }
  expect(caught.code).toBe("VALIDATION");
  expect(caught.message).toMatch(message);
}

describe("buildFilterExpression", () => {
  it.each([
    {
      name: "reserved word equality",
      filters: [{ attribute: "status", op: "=" as const, value: { S: "SHIPPED" } }],
      joiner: "and" as const,
      expression: "(#n0 = :v0)",
      names: { "#n0": "status" },
      values: { ":v0": { S: "SHIPPED" } },
    },
    {
      name: "name attribute",
      filters: [{ attribute: "name", op: "=" as const, value: { S: "Ada" } }],
      joiner: "and" as const,
      expression: "(#n0 = :v0)",
      names: { "#n0": "name" },
      values: { ":v0": { S: "Ada" } },
    },
    {
      name: "nested path",
      filters: [{ attribute: "address.city", op: "=" as const, value: { S: "Pune" } }],
      joiner: "and" as const,
      expression: "(#n0.#n1 = :v0)",
      names: { "#n0": "address", "#n1": "city" },
      values: { ":v0": { S: "Pune" } },
    },
    {
      name: "list index",
      filters: [{ attribute: "items[0].sku", op: "=" as const, value: { S: "A" } }],
      joiner: "and" as const,
      expression: "(#n0[0].#n1 = :v0)",
      names: { "#n0": "items", "#n1": "sku" },
      values: { ":v0": { S: "A" } },
    },
    {
      name: "space and unicode",
      filters: [
        { attribute: "full name", op: "=" as const, value: { S: "Ada" } },
        { attribute: "名前", op: "=" as const, value: { S: "A" } },
      ],
      joiner: "or" as const,
      expression: "(#n0 = :v0) OR (#n1 = :v1)",
      names: { "#n0": "full name", "#n1": "名前" },
      values: { ":v0": { S: "Ada" }, ":v1": { S: "A" } },
    },
    {
      name: "38-digit number",
      filters: [{ attribute: "digits", op: "=" as const, value: { N: DIGITS } }],
      joiner: "and" as const,
      expression: "(#n0 = :v0)",
      names: { "#n0": "digits" },
      values: { ":v0": { N: DIGITS } },
    },
    {
      name: "scientific number",
      filters: [{ attribute: "digits", op: "=" as const, value: { N: "1E+2" } }],
      joiner: "and" as const,
      expression: "(#n0 = :v0)",
      names: { "#n0": "digits" },
      values: { ":v0": { N: "1E+2" } },
    },
    {
      name: "comparisons",
      filters: [{ attribute: "amount", op: "<>" as const, value: { N: "1" } }],
      joiner: "and" as const,
      expression: "(#n0 <> :v0)",
      names: { "#n0": "amount" },
      values: { ":v0": { N: "1" } },
    },
    {
      name: "between",
      filters: [
        { attribute: "amount", op: "between" as const, value: { N: "1" }, value2: { N: "2" } },
      ],
      joiner: "and" as const,
      expression: "(#n0 BETWEEN :v0 AND :v1)",
      names: { "#n0": "amount" },
      values: { ":v0": { N: "1" }, ":v1": { N: "2" } },
    },
    {
      name: "begins_with",
      filters: [{ attribute: "email", op: "begins_with" as const, value: { S: "a" } }],
      joiner: "and" as const,
      expression: "(begins_with(#n0, :v0))",
      names: { "#n0": "email" },
      values: { ":v0": { S: "a" } },
    },
    {
      name: "contains and not_contains",
      filters: [
        { attribute: "labels", op: "contains" as const, value: { S: "alpha" } },
        { attribute: "labels", op: "not_contains" as const, value: { S: "beta" } },
      ],
      joiner: "and" as const,
      expression: "(contains(#n0, :v0)) AND (NOT contains(#n0, :v1))",
      names: { "#n0": "labels" },
      values: { ":v0": { S: "alpha" }, ":v1": { S: "beta" } },
    },
    {
      name: "exists",
      filters: [
        { attribute: "ttl", op: "exists" as const },
        { attribute: "gone", op: "not_exists" as const },
      ],
      joiner: "and" as const,
      expression: "(attribute_exists(#n0)) AND (attribute_not_exists(#n1))",
      names: { "#n0": "ttl", "#n1": "gone" },
      values: {},
    },
    {
      name: "in",
      filters: [
        {
          attribute: "status",
          op: "in" as const,
          values: [{ S: "SHIPPED" }, { S: "PENDING" }],
        },
      ],
      joiner: "and" as const,
      expression: "(#n0 IN (:v0, :v1))",
      names: { "#n0": "status" },
      values: { ":v0": { S: "SHIPPED" }, ":v1": { S: "PENDING" } },
    },
    {
      name: "type_is",
      filters: [{ attribute: "digits", op: "type_is" as const, value: { S: "N" } }],
      joiner: "and" as const,
      expression: "(attribute_type(#n0, :v0))",
      names: { "#n0": "digits" },
      values: { ":v0": { S: "N" } },
    },
    {
      name: "shared name segments",
      filters: [
        { attribute: "address.city", op: "=" as const, value: { S: "Pune" } },
        { attribute: "address.zip", op: "=" as const, value: { S: "411" } },
      ],
      joiner: "and" as const,
      expression: "(#n0.#n1 = :v0) AND (#n0.#n2 = :v1)",
      names: { "#n0": "address", "#n1": "city", "#n2": "zip" },
      values: { ":v0": { S: "Pune" }, ":v1": { S: "411" } },
    },
  ])("$name", ({ filters, joiner, expression, names, values }) => {
    expectBuilt(filters, joiner, expression, names, values);
  });

  it("passes binary, boolean, null, set, list, and map values through unchanged", () => {
    const value: AttributeValue = {
      L: [
        { BOOL: true },
        { NULL: true },
        { B: "QUI=" },
        { SS: ["a"] },
        { M: { n: { N: DIGITS } } },
      ],
    };
    const built = buildFilterExpression([{ attribute: "payload", op: "=", value }], "and");
    expect(built?.values[":v0"]).toEqual(value);
    expect(JSON.stringify(built?.values)).toContain(DIGITS);
    expect(built?.expression.includes(DIGITS)).toBe(false);
  });

  it("returns nothing when there are no filters", () => {
    expect(buildFilterExpression([], "and")).toBeUndefined();
  });

  it("rejects paths, counts, and operator shapes", () => {
    const comparisons: FilterOp[] = ["<", "<=", ">", ">="];
    for (const op of comparisons) {
      const built = buildFilterExpression([{ attribute: "n", op, value: { N: "1" } }], "and");
      expect(built?.expression).toBe(`(#n0 ${op} :v0)`);
    }
    expectInvalid(
      () => buildFilterExpression([{ attribute: "status", op: "=" }], "and"),
      /one value/,
    );
    expectInvalid(
      () =>
        buildFilterExpression([{ attribute: "status", op: "exists", value: { S: "x" } }], "and"),
      /do not take a value/,
    );
    expectInvalid(
      () =>
        buildFilterExpression([{ attribute: "amount", op: "between", value: { N: "1" } }], "and"),
      /two values/,
    );
    expectInvalid(
      () =>
        buildFilterExpression(
          [
            {
              attribute: "amount",
              op: "between",
              value: { N: "1" },
              value2: { N: "2" },
              values: [{ N: "3" }],
            },
          ],
          "and",
        ),
      /two values/,
    );
    expectInvalid(
      () =>
        buildFilterExpression(
          [{ attribute: "status", op: "in", value: { S: "SHIPPED" }, values: [{ S: "PENDING" }] }],
          "and",
        ),
      /1 to 100/,
    );
    expect(
      buildFilterExpression([{ attribute: "tags[0][1]", op: "exists" }], "and")?.expression,
    ).toBe("(attribute_exists(#n0[0][1]))");
    expectInvalid(
      () => buildFilterExpression([{ attribute: "[0]", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "status", op: "in", values: [] }], "and"),
      /1 to 100/,
    );
    const tooMany = Array.from({ length: 101 }, () => ({ S: "a" }));
    expectInvalid(
      () => buildFilterExpression([{ attribute: "status", op: "in", values: tooMany }], "and"),
      /1 to 100/,
    );
    expectInvalid(
      () =>
        buildFilterExpression([{ attribute: "digits", op: "type_is", value: { N: "1" } }], "and"),
      /not a DynamoDB type/,
    );
    expectInvalid(
      () =>
        buildFilterExpression(
          Array.from({ length: 21 }, () => ({ attribute: "a", op: "exists" as const })),
          "and",
        ),
      /20 filters/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: ".a", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a.", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a..b", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a]", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a[", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a[]", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a[x]", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a[01]", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a[0]b", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a[0].", op: "exists" }], "and"),
      /not valid/,
    );
    expectInvalid(
      () => buildFilterExpression([{ attribute: "a".repeat(256), op: "exists" }], "and"),
      /255/,
    );
    const deep = Array.from({ length: 33 }, () => "a").join(".");
    expectInvalid(
      () => buildFilterExpression([{ attribute: deep, op: "exists" }], "and"),
      /too deep/,
    );
    expect(
      buildFilterExpression([{ attribute: `${"a.".repeat(31)}a`, op: "exists" }], "and"),
    ).toBeDefined();
  });

  it("keeps user text out of expression strings", () => {
    const reserved = ["status", "name", "size", "data", "type", "year", "timestamp"];
    const segment = fc.oneof(
      fc.constantFrom(...reserved, "full name", "名前", "order id"),
      fc
        .string({ minLength: 1, maxLength: 8, unit: "grapheme-ascii" })
        .map((value) => `attr_${value.replace(/[^A-Za-z0-9]/g, "x")}`),
    );
    const text = fc
      .string({ minLength: 1, maxLength: 12, unit: "grapheme-ascii" })
      .map((value) => `val_${value.replace(/[^A-Za-z0-9]/g, "x")}`);
    const number = fc.stringMatching(/^[1-9][0-9]{37}$/);
    const op = fc.constantFrom<FilterOp>(
      "=",
      "<>",
      "<",
      "<=",
      ">",
      ">=",
      "between",
      "begins_with",
      "contains",
      "not_contains",
      "exists",
      "not_exists",
      "in",
      "type_is",
    );
    fc.assert(
      fc.property(
        fc.array(segment, { minLength: 1, maxLength: 3 }),
        fc.boolean(),
        op,
        text,
        number,
        fc.constantFrom("and" as const, "or" as const),
        (parts, indexed, operator, raw, digits, joiner) => {
          const attribute = `${parts.join(".")}${indexed ? "[0]" : ""}`;
          const filter = filterFor(attribute, operator, raw, digits);
          const built = buildFilterExpression([filter], joiner);
          expect(built).toBeDefined();
          if (built === undefined) {
            return;
          }
          assertPlaceholdersOnly(built.expression);
          for (const name of Object.values(built.names)) {
            expect(withoutOperators(built.expression).includes(name)).toBe(false);
          }
          expect(built.expression.includes(raw)).toBe(false);
          expect(built.expression.includes(digits)).toBe(false);
          const stored = JSON.stringify(built.values);
          if (operator === "between" || operator === "=") {
            expect(stored).toContain(digits);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

function filterFor(attribute: string, op: FilterOp, raw: string, digits: string): Filter {
  if (op === "exists" || op === "not_exists") {
    return { attribute, op };
  }
  if (op === "between") {
    return { attribute, op, value: { N: digits }, value2: { N: `1${digits.slice(1)}` } };
  }
  if (op === "in") {
    return { attribute, op, values: [{ S: raw }, { N: digits }] };
  }
  if (op === "type_is") {
    return { attribute, op, value: { S: "N" } };
  }
  if (op === "=") {
    return { attribute, op, value: { N: digits } };
  }
  return { attribute, op, value: { S: raw } };
}

describe("buildProjectionExpression", () => {
  it("aliases nested paths and reuses names", () => {
    const built = buildProjectionExpression(["address.city", "status", "items[0].sku"]);
    expect(built.expression).toBe("#n0.#n1, #n2, #n3[0].#n4");
    expect(built.names).toEqual({
      "#n0": "address",
      "#n1": "city",
      "#n2": "status",
      "#n3": "items",
      "#n4": "sku",
    });
    expect(built.values).toEqual({});
    assertPlaceholdersOnly(built.expression);
    expect(built.expression.includes("address")).toBe(false);
    expect(built.expression.includes("status")).toBe(false);
  });

  it("rejects an empty list and an invalid path", () => {
    expectInvalid(() => buildProjectionExpression([]), /at least one/);
    expectInvalid(() => buildProjectionExpression(["a..b"]), /not valid/);
    expectInvalid(
      () =>
        buildProjectionExpression(
          Array.from({ length: 1025 }, (_unused, index) => `a${String(index)}`),
        ),
      /1024/,
    );
  });
});
