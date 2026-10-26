import { describe, expect, it } from "vitest";
import { QueryRequest } from "./query.js";

describe("QueryRequest", () => {
  it("defaults the page and keeps a number as text", () => {
    const parsed = QueryRequest.parse({
      key: { pk: { name: "id", value: { N: "1E+2" } } },
    });
    expect(parsed.limit).toBe(50);
    expect(parsed.scanForward).toBe(true);
    expect(parsed.filterJoiner).toBe("and");
    expect(parsed.key.pk.value).toEqual({ N: "1E+2" });
  });

  it("rejects an unknown field", () => {
    expect(() =>
      QueryRequest.parse({
        key: { pk: { name: "id", value: { S: "a" } } },
        kind: "select",
      }),
    ).toThrow();
  });
});
