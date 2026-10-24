import { describe, expect, it } from "vitest";
import { HttpError } from "../http-error.js";
import {
  decodeScanCursor,
  encodeScanCursor,
  scanContextHash,
  type ScanCursorContext,
} from "./scan-cursor.js";

const digits = "12345678901234567890123456789012345678";

const context: ScanCursorContext = {
  table: "orders",
  filterJoiner: "and",
  filters: [{ attribute: "status", op: "=", value: { S: "SHIPPED" } }],
  projection: ["orderId"],
  consistentRead: false,
};

describe("scan cursors", () => {
  it("round-trips a key and keeps a 38-digit number as a string", () => {
    const lek = { id: { S: "a" }, digits: { N: digits } };
    const cursor = encodeScanCursor(lek, context);
    const decoded = decodeScanCursor(cursor, context);
    expect(decoded).toEqual(lek);
    const number = decoded.digits;
    if (number === undefined || !("N" in number)) {
      throw new Error("expected a number");
    }
    expect(typeof number.N).toBe("string");
    expect(number.N).toBe(digits);
  });

  it("hashes the same request shape even when object keys are ordered differently", () => {
    const left = scanContextHash(context);
    const right = scanContextHash({
      ...context,
      filters: [{ op: "=", value: { S: "SHIPPED" }, attribute: "status" }],
    });
    expect(left).toBe(right);
  });

  it("rejects a cursor from a different filter, table, or a broken payload", () => {
    const cursor = encodeScanCursor({ id: { S: "a" } }, context);
    expect(() =>
      decodeScanCursor(cursor, {
        ...context,
        filters: [{ attribute: "status", op: "=", value: { S: "PENDING" } }],
      }),
    ).toThrow(HttpError);
    expect(() => decodeScanCursor(cursor, { ...context, table: "users" })).toThrow(
      /does not match/,
    );
    expect(() => decodeScanCursor(cursor, { ...context, index: "status-createdAt-index" })).toThrow(
      /does not match/,
    );
    expect(() => decodeScanCursor("not-a-cursor", context)).toThrow(/not valid/);
  });
});
