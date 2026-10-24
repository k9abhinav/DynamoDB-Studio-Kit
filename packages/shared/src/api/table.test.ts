import { describe, expect, it } from "vitest";
import {
  TABLE_LIST_MAX_NAMES,
  TABLE_LIST_PAGE_MAX,
  TableDescription,
  TableListQuery,
  TableListResponse,
  TableWaitResponse,
} from "./table.js";

const orders = {
  name: "orders",
  status: "ACTIVE",
  arn: "arn:aws:dynamodb:us-east-1:000000000000:table/orders",
  keySchema: [
    { name: "userId", type: "S", keyType: "HASH" },
    { name: "createdAt", type: "S", keyType: "RANGE" },
  ],
  attributeDefinitions: [
    { name: "userId", type: "S" },
    { name: "createdAt", type: "S" },
    { name: "status", type: "S" },
  ],
  billing: { mode: "PAY_PER_REQUEST" },
  itemCount: 10000,
  sizeBytes: 2048,
  gsis: [
    {
      name: "status-createdAt-index",
      status: "ACTIVE",
      keys: [
        { name: "status", type: "S", keyType: "HASH" },
        { name: "createdAt", type: "S", keyType: "RANGE" },
      ],
      projection: { type: "ALL" },
    },
  ],
  lsis: [],
  ttl: { enabled: false },
  stream: { enabled: false },
  deletionProtection: false,
  createdAt: "2026-10-23T12:00:00.000Z",
};

describe("table schemas", () => {
  it("accepts the orders description and a dotted table name", () => {
    expect(TableDescription.parse(orders).gsis[0]?.name).toBe("status-createdAt-index");
    expect(TableDescription.parse({ ...orders, name: "my.table-v2" }).name).toBe("my.table-v2");
  });

  it("rejects names outside the DynamoDB table pattern", () => {
    for (const name of ["ab", "my table", "my/table", "a".repeat(256)]) {
      expect(TableDescription.safeParse({ ...orders, name }).success).toBe(false);
    }
  });

  it("rejects unknown keys, a negative count, and on-demand capacity", () => {
    expect(TableDescription.safeParse({ ...orders, region: "us-east-1" }).success).toBe(false);
    expect(TableDescription.safeParse({ ...orders, itemCount: -1 }).success).toBe(false);
    expect(
      TableDescription.safeParse({ ...orders, billing: { mode: "PAY_PER_REQUEST", rcu: 1 } })
        .success,
    ).toBe(false);
  });

  it("requires provisioned capacity and a TTL attribute when TTL is enabled", () => {
    expect(
      TableDescription.safeParse({ ...orders, billing: { mode: "PROVISIONED" } }).success,
    ).toBe(false);
    expect(
      TableDescription.parse({
        ...orders,
        billing: { mode: "PROVISIONED", rcu: 5, wcu: 5 },
        ttl: { enabled: true, attribute: "expiresAt" },
      }).ttl,
    ).toEqual({ enabled: true, attribute: "expiresAt" });
    expect(TableDescription.safeParse({ ...orders, ttl: { enabled: true } }).success).toBe(false);
  });

  it("requires one partition key and a stream view only while the stream is on", () => {
    expect(TableDescription.safeParse({ ...orders, keySchema: [] }).success).toBe(false);
    expect(
      TableDescription.safeParse({
        ...orders,
        stream: { enabled: true },
      }).success,
    ).toBe(false);
    expect(
      TableDescription.parse({
        ...orders,
        status: "ARCHIVED",
        stream: { enabled: true, viewType: "NEW_IMAGE" },
      }).status,
    ).toBe("ARCHIVED");
  });

  it("lists names with an optional cursor and caps a page at 100", () => {
    expect(TABLE_LIST_PAGE_MAX).toBe(100);
    expect(TABLE_LIST_MAX_NAMES).toBe(5000);
    expect(
      TableListResponse.parse({ tables: ["users", "my.table-v2"] }).nextCursor,
    ).toBeUndefined();
    expect(TableListResponse.safeParse({ tables: ["no"] }).success).toBe(false);
    expect(TableListQuery.parse({ limit: "100", search: "ord" })).toEqual({
      limit: 100,
      search: "ord",
    });
    expect(TableListQuery.safeParse({ limit: "101" }).success).toBe(false);
    expect(TableListQuery.safeParse({ limit: "100", extra: true }).success).toBe(false);
    expect(TableWaitResponse.parse({ status: "CREATING" }).status).toBe("CREATING");
  });
});
