import { describe, expect, it } from "vitest";
import { Filter } from "./filter.js";
import { ScanRequest, ScanResponse } from "./scan.js";

const digits = "12345678901234567890123456789012345678";

describe("Filter", () => {
  it("keeps a 38-digit number and 1E+2 as decimal strings", () => {
    const parsed = Filter.parse({ attribute: "digits", op: "=", value: { N: digits } });
    expect(parsed.value).toEqual({ N: digits });
    if (parsed.value === undefined || !("N" in parsed.value)) {
      throw new Error("expected a number value");
    }
    expect(typeof parsed.value.N).toBe("string");
    expect(Filter.parse({ attribute: "n", op: "=", value: { N: "1E+2" } }).value).toEqual({
      N: "1E+2",
    });
  });

  it("rejects a per-filter joiner", () => {
    expect(() => Filter.parse({ attribute: "status", op: "exists", joiner: "and" })).toThrow();
  });

  it("checks the values each operator needs", () => {
    expect(Filter.parse({ attribute: "status", op: "exists" })).toMatchObject({ op: "exists" });
    expect(() => Filter.parse({ attribute: "status", op: "exists", value: { S: "x" } })).toThrow(
      /do not take a value/,
    );
    expect(() => Filter.parse({ attribute: "n", op: "between", value: { N: "1" } })).toThrow(
      /two values/,
    );
    expect(() => Filter.parse({ attribute: "status", op: "in", values: [] })).toThrow();
    expect(() =>
      Filter.parse({ attribute: "status", op: "type_is", value: { S: "NOPE" } }),
    ).toThrow(/not a DynamoDB type/);
    expect(Filter.parse({ attribute: "status", op: "type_is", value: { S: "S" } }).op).toBe(
      "type_is",
    );
  });
});

describe("ScanRequest", () => {
  it("defaults the page size to 50 and the joiner to and", () => {
    expect(ScanRequest.parse({})).toEqual({ limit: 50, filterJoiner: "and" });
  });

  it("rejects unknown keys, too many filters, and a bad page size", () => {
    expect(() => ScanRequest.parse({ joiner: "and" })).toThrow();
    const filters = Array.from({ length: 21 }, () => ({ attribute: "status", op: "exists" }));
    expect(() => ScanRequest.parse({ filters })).toThrow();
    expect(() => ScanRequest.parse({ limit: 0 })).toThrow();
    expect(() => ScanRequest.parse({ limit: 1001 })).toThrow();
    expect(() => ScanRequest.parse({ segment: { index: 2, total: 2 } })).toThrow(/Segment/);
  });

  it("accepts a nested filter whose number stays a string", () => {
    const parsed = ScanRequest.parse({
      filters: [{ attribute: "address.city", op: "=", value: { S: "Pune" } }],
      fillPage: true,
    });
    expect(parsed.filters?.[0]?.value).toEqual({ S: "Pune" });
    const numbered = ScanRequest.parse({
      filters: [{ attribute: "digits", op: "=", value: { N: digits } }],
    });
    expect(numbered.filters?.[0]?.value).toEqual({ N: digits });
  });
});

describe("ScanResponse", () => {
  it("requires the count, the cursor, and the scanned count to agree", () => {
    expect(
      ScanResponse.parse({
        items: [{ id: { S: "a" } }],
        count: 1,
        scannedCount: 4,
        hasMore: true,
        nextCursor: "cursor",
        consumedCapacity: { rcu: 0.5 },
      }).consumedCapacity,
    ).toEqual({ rcu: 0.5 });
    expect(() =>
      ScanResponse.parse({
        items: [],
        count: 1,
        scannedCount: 1,
        hasMore: false,
      }),
    ).toThrow(/Count/);
    expect(() =>
      ScanResponse.parse({
        items: [],
        count: 0,
        scannedCount: 0,
        hasMore: true,
      }),
    ).toThrow(/cursor/);
  });
});
