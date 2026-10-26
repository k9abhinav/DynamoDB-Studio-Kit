import { describe, expect, it } from "vitest";
import { QueryRequestError, buildKeyCondition, type KeySort } from "./query-request.js";

const DIGITS = "12345678901234567890123456789012345678";

describe("buildKeyCondition", () => {
  it("requires the partition key and aliases every name", () => {
    const built = buildKeyCondition({
      partitionKey: { name: "status", value: { S: "SHIPPED" } },
    });
    expect(built).toEqual({
      expression: "#n0 = :v0",
      names: { "#n0": "status" },
      values: { ":v0": { S: "SHIPPED" } },
    });
    expect(built.expression.includes("status")).toBe(false);
  });

  it("builds every sort-key operator with placeholders only", () => {
    const cases: Array<{ sort: KeySort; expression: string }> = [
      {
        sort: { name: "createdAt", op: "=", value: { S: "a" } },
        expression: "#n0 = :v0 AND #n1 = :v1",
      },
      {
        sort: { name: "createdAt", op: "<", value: { S: "a" } },
        expression: "#n0 = :v0 AND #n1 < :v1",
      },
      {
        sort: { name: "createdAt", op: "<=", value: { S: "a" } },
        expression: "#n0 = :v0 AND #n1 <= :v1",
      },
      {
        sort: { name: "createdAt", op: ">", value: { S: "a" } },
        expression: "#n0 = :v0 AND #n1 > :v1",
      },
      {
        sort: { name: "createdAt", op: ">=", value: { S: "a" } },
        expression: "#n0 = :v0 AND #n1 >= :v1",
      },
      {
        sort: { name: "createdAt", op: "between", value: { S: "a" }, value2: { S: "z" } },
        expression: "#n0 = :v0 AND #n1 BETWEEN :v1 AND :v2",
      },
      {
        sort: { name: "createdAt", op: "begins_with", value: { S: "2024" } },
        expression: "#n0 = :v0 AND begins_with(#n1, :v1)",
      },
    ];
    for (const entry of cases) {
      const built = buildKeyCondition({
        partitionKey: { name: "userId", value: { S: "user-0001" } },
        sortKey: entry.sort,
      });
      expect(built.expression).toBe(entry.expression);
      expect(
        built.expression.replace(/#n\d+|:v\d+|begins_with|BETWEEN|AND|<=|>=|<|>|=|\(|\)|,|\s/g, ""),
      ).toBe("");
      expect(built.names).toEqual({ "#n0": "userId", "#n1": "createdAt" });
    }
  });

  it("keeps number text exact, including a 38-digit value and 1E+2", () => {
    const built = buildKeyCondition({
      partitionKey: { name: "id", value: { N: DIGITS } },
      sortKey: { name: "n", op: "=", value: { N: "1E+2" } },
    });
    expect(built.values).toEqual({
      ":v0": { N: DIGITS },
      ":v1": { N: "1E+2" },
    });
    expect(built.values[":v1"]).toEqual({ N: "1E+2" });
  });

  it("allows begins_with on string and binary sort keys", () => {
    const text = buildKeyCondition({
      partitionKey: { name: "pk", value: { S: "a" } },
      sortKey: { name: "sk", op: "begins_with", value: { S: "pre" } },
    });
    const binary = buildKeyCondition({
      partitionKey: { name: "pk", value: { B: "YQ==" } },
      sortKey: { name: "sk", op: "begins_with", value: { B: "Yg==" } },
    });
    expect(text.expression).toContain("begins_with");
    expect(binary.values[":v1"]).toEqual({ B: "Yg==" });
  });

  it("aliases reserved words and does not copy them into the expression", () => {
    const built = buildKeyCondition({
      partitionKey: { name: "name", value: { S: "ada" } },
      sortKey: { name: "timestamp", op: ">=", value: { N: "2.50" } },
    });
    expect(built.names).toEqual({ "#n0": "name", "#n1": "timestamp" });
    expect(built.values[":v1"]).toEqual({ N: "2.50" });
    expect(built.expression.includes("name")).toBe(false);
    expect(built.expression.includes("timestamp")).toBe(false);
    expect(built.expression.includes("2.50")).toBe(false);
  });

  it("rejects an empty key, a non-key type, and begins_with on a number", () => {
    expect(() => buildKeyCondition({ partitionKey: { name: "id", value: { S: "" } } })).toThrow(
      QueryRequestError,
    );
    expect(() =>
      buildKeyCondition({ partitionKey: { name: "id", value: { BOOL: true } } }),
    ).toThrow(/string, number, or binary/);
    expect(() =>
      buildKeyCondition({
        partitionKey: { name: "id", value: { S: "a" } },
        sortKey: { name: "n", op: "begins_with", value: { N: "10" } },
      }),
    ).toThrow(/begins_with works on strings and binary/);
    expect(() =>
      buildKeyCondition({
        partitionKey: { name: "id", value: { S: "a" } },
        sortKey: { name: "id", op: "=", value: { S: "b" } },
      }),
    ).toThrow(/different attribute/);
    expect(() =>
      buildKeyCondition({
        partitionKey: { name: "id", value: { S: "a" } },
        sortKey: { name: "sk", op: "between", value: { S: "a" } },
      }),
    ).toThrow(/Between needs two values/);
  });
});
