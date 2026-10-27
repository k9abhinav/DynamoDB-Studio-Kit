import { describe, expect, it } from "vitest";
import { TableDescription } from "@dynamo-studio/shared";
import { normalizeTable, type RawTable } from "./normalize-table.js";

const orders: RawTable = {
  TableName: "orders",
  TableStatus: "ACTIVE",
  TableArn: "arn:aws:dynamodb:us-east-1:000000000000:table/orders",
  CreationDateTime: new Date("2026-10-23T12:00:00.000Z"),
  ItemCount: 10_000,
  TableSizeBytes: 2048,
  BillingModeSummary: { BillingMode: "PAY_PER_REQUEST" },
  AttributeDefinitions: [
    { AttributeName: "userId", AttributeType: "S" },
    { AttributeName: "createdAt", AttributeType: "S" },
    { AttributeName: "status", AttributeType: "S" },
  ],
  KeySchema: [
    { AttributeName: "userId", KeyType: "HASH" },
    { AttributeName: "createdAt", KeyType: "RANGE" },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "status-createdAt-index",
      IndexStatus: "ACTIVE",
      KeySchema: [
        { AttributeName: "status", KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    },
  ],
};

describe("normalizeTable", () => {
  it("keeps orders keys, the status index, and approximate counts", () => {
    const described = TableDescription.parse(
      normalizeTable(orders, { TimeToLiveStatus: "DISABLED" }),
    );
    expect(described.keySchema).toEqual([
      { name: "userId", type: "S", keyType: "HASH" },
      { name: "createdAt", type: "S", keyType: "RANGE" },
    ]);
    expect(described.gsis[0]).toMatchObject({
      name: "status-createdAt-index",
      status: "ACTIVE",
      projection: { type: "ALL" },
    });
    expect(described.itemCount).toBe(10_000);
    expect(described.billing).toEqual({ mode: "PAY_PER_REQUEST" });
    expect(described.ttl).toEqual({ enabled: false });
  });

  it("enables TTL on sessions and accepts a dotted table name", () => {
    const sessions = normalizeTable(
      {
        ...orders,
        TableName: "sessions",
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        GlobalSecondaryIndexes: [],
      },
      { TimeToLiveStatus: "ENABLED", AttributeName: "expiresAt" },
    );
    expect(sessions.ttl).toEqual({ enabled: true, attribute: "expiresAt" });
    expect(
      normalizeTable({ ...orders, TableName: "my.table-v2" }, { TimeToLiveStatus: "DISABLED" })
        .name,
    ).toBe("my.table-v2");
  });

  it("marks a creating index and keeps archived status", () => {
    const creating = normalizeTable(
      {
        ...orders,
        TableStatus: "ARCHIVED",
        GlobalSecondaryIndexes: [
          {
            IndexName: "status-createdAt-index",
            IndexStatus: "CREATING",
            KeySchema: [
              { AttributeName: "status", KeyType: "HASH" },
              { AttributeName: "createdAt", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
          },
        ],
      },
      { TimeToLiveStatus: "DISABLED" },
    );
    expect(creating.status).toBe("ARCHIVED");
    expect(creating.gsis[0]?.status).toBe("CREATING");
  });

  it("omits an index that is deleting after its key attribute is gone", () => {
    const deleting = normalizeTable(
      {
        ...orders,
        AttributeDefinitions: [
          { AttributeName: "userId", AttributeType: "S" },
          { AttributeName: "createdAt", AttributeType: "S" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "status-createdAt-index",
            IndexStatus: "DELETING",
            KeySchema: [{ AttributeName: "status", KeyType: "HASH" }],
            Projection: { ProjectionType: "KEYS_ONLY" },
          },
        ],
      },
      { TimeToLiveStatus: "DISABLED" },
    );
    expect(deleting.gsis[0]?.status).toBe("DELETING");
    expect(deleting.gsis[0]?.keys[0]).toEqual({ name: "status", type: "S", keyType: "HASH" });
  });
});
