import { describe, expect, it } from "vitest";
import { buildCreateTableRequest } from "./create-table-request.js";
import { CreateTableBody, UpdateTableBody } from "./create-table.js";

const keys = {
  name: "orders",
  partitionKey: { name: "userId", type: "S" as const },
  sortKey: { name: "createdAt", type: "S" as const },
};

describe("create table schemas", () => {
  it("rejects names outside the DynamoDB table pattern", () => {
    for (const name of ["ab", "my table", "my/table", "a".repeat(256)]) {
      expect(CreateTableBody.safeParse({ ...keys, name }).success).toBe(false);
    }
  });

  it("rejects a sort key that reuses the partition key name", () => {
    expect(
      CreateTableBody.safeParse({
        ...keys,
        sortKey: { name: "userId", type: "S" },
      }).success,
    ).toBe(false);
  });

  it("rejects two indexes with the same name and a key whose type changes", () => {
    const gsi = {
      name: "status-index",
      partitionKey: { name: "status", type: "S" as const },
      projection: { type: "ALL" as const },
    };
    expect(CreateTableBody.safeParse({ ...keys, gsis: [gsi, gsi] }).success).toBe(false);
    expect(
      CreateTableBody.safeParse({
        ...keys,
        gsis: [{ ...gsi, partitionKey: { name: "userId", type: "N" } }],
      }).success,
    ).toBe(false);
  });

  it("rejects capacity on an on-demand index and a string TTL key", () => {
    expect(
      CreateTableBody.safeParse({
        ...keys,
        gsis: [
          {
            name: "status-index",
            partitionKey: { name: "status", type: "S" },
            projection: { type: "ALL" },
            rcu: 5,
            wcu: 5,
          },
        ],
      }).success,
    ).toBe(false);
    expect(CreateTableBody.safeParse({ ...keys, ttlAttribute: "userId" }).success).toBe(false);
  });

  it("rejects an empty update and two index changes at once", () => {
    expect(UpdateTableBody.safeParse({}).success).toBe(false);
    expect(UpdateTableBody.safeParse({ extra: true }).success).toBe(false);
    expect(
      UpdateTableBody.safeParse({
        gsiDelete: "status-index",
        gsiCreate: {
          name: "next-index",
          partitionKey: { name: "status", type: "S" },
          projection: { type: "KEYS_ONLY" },
        },
      }).success,
    ).toBe(false);
    expect(UpdateTableBody.safeParse({ ttl: { enabled: true } }).success).toBe(false);
  });
});

describe("buildCreateTableRequest", () => {
  it("builds an on-demand create with a TTL follow-up and no credentials", () => {
    const preview = buildCreateTableRequest({
      ...keys,
      deletionProtection: true,
      ttlAttribute: "expiresAt",
      gsis: [
        {
          name: "status-index",
          partitionKey: { name: "status", type: "S" },
          projection: { type: "INCLUDE", attributes: ["total"] },
        },
      ],
    });
    expect(preview.createTable).toEqual({
      TableName: "orders",
      AttributeDefinitions: [
        { AttributeName: "userId", AttributeType: "S" },
        { AttributeName: "createdAt", AttributeType: "S" },
        { AttributeName: "status", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
      DeletionProtectionEnabled: true,
      GlobalSecondaryIndexes: [
        {
          IndexName: "status-index",
          KeySchema: [{ AttributeName: "status", KeyType: "HASH" }],
          Projection: { ProjectionType: "INCLUDE", NonKeyAttributes: ["total"] },
        },
      ],
    });
    expect(preview.updateTimeToLive).toEqual({
      TableName: "orders",
      TimeToLiveSpecification: { Enabled: true, AttributeName: "expiresAt" },
    });
    expect(JSON.stringify(preview)).not.toMatch(/secret|credential|accessKey|endpoint/i);
    expect(preview.createTable).not.toHaveProperty("ProvisionedThroughput");
  });

  it("copies table capacity onto a provisioned index that omits its own", () => {
    const preview = buildCreateTableRequest({
      name: "sessions",
      partitionKey: { name: "id", type: "S" },
      billing: { mode: "PROVISIONED", rcu: 5, wcu: 2 },
      gsis: [
        {
          name: "owner-index",
          partitionKey: { name: "owner", type: "S" },
          projection: { type: "KEYS_ONLY" },
        },
        {
          name: "hot-index",
          partitionKey: { name: "hot", type: "N" },
          projection: { type: "ALL" },
          rcu: 10,
          wcu: 10,
        },
      ],
    });
    expect(preview.createTable.ProvisionedThroughput).toEqual({
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 2,
    });
    expect(preview.createTable.GlobalSecondaryIndexes?.[0]?.ProvisionedThroughput).toEqual({
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 2,
    });
    expect(preview.createTable.GlobalSecondaryIndexes?.[1]?.ProvisionedThroughput).toEqual({
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10,
    });
    expect(preview.updateTimeToLive).toBeUndefined();
  });
});
