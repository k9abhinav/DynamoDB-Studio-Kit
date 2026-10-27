import { describe, expect, it } from "vitest";
import { TableDescription } from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";
import { assertIndexesSettled, assertNameConfirm } from "./manage-table.js";

const active = TableDescription.parse({
  name: "orders",
  status: "ACTIVE",
  arn: "arn:aws:dynamodb:us-east-1:000000000000:table/orders",
  keySchema: [{ name: "id", type: "S", keyType: "HASH" }],
  attributeDefinitions: [{ name: "id", type: "S" }],
  billing: { mode: "PAY_PER_REQUEST" },
  itemCount: 0,
  sizeBytes: 0,
  gsis: [
    {
      name: "status-index",
      status: "ACTIVE",
      keys: [{ name: "status", type: "S", keyType: "HASH" }],
      projection: { type: "ALL" },
    },
  ],
  lsis: [],
  ttl: { enabled: false },
  stream: { enabled: false },
  deletionProtection: false,
  createdAt: "2026-10-27T00:00:00.000Z",
});

describe("table change guards", () => {
  it("requires the typed table name before a delete", () => {
    expect(() => {
      assertNameConfirm("orders", "orders");
    }).not.toThrow();
    expect(() => {
      assertNameConfirm("order", "orders");
    }).toThrow(HttpError);
    try {
      assertNameConfirm("order", "orders");
    } catch (error) {
      expect(error).toMatchObject({
        code: "VALIDATION",
        message: "Type the table name to confirm.",
      });
    }
  });

  it("refuses an update while an index is still being created", () => {
    const index = active.gsis[0];
    if (index === undefined) {
      throw new Error("missing index");
    }
    const creating = TableDescription.parse({
      ...active,
      gsis: [{ ...index, status: "CREATING" }],
    });
    expect(() => {
      assertIndexesSettled(creating);
    }).toThrow(/status-index is ACTIVE/);
    expect(() => {
      assertIndexesSettled(active);
    }).not.toThrow();
  });
});
