import { describe, expect, it } from "vitest";
import {
  QUERY_NEEDS_PARTITION,
  awsQueryCommand,
  buildQueryBody,
  emptyQueryDraft,
  hexToBase64,
  queryFormMessage,
  queryTargets,
  type QueryTarget,
} from "./query-form.js";

const orders: QueryTarget = {
  label: "Table",
  kind: "table",
  partition: { name: "userId", type: "S" },
  sort: { name: "createdAt", type: "S" },
};

const gsi: QueryTarget = {
  label: "status-createdAt-index",
  index: "status-createdAt-index",
  kind: "gsi",
  partition: { name: "status", type: "S" },
  sort: { name: "createdAt", type: "S" },
};

describe("query form", () => {
  it("requires a partition key and keeps numbers as text", () => {
    expect(queryFormMessage(orders, emptyQueryDraft())).toBe(QUERY_NEEDS_PARTITION);
    const built = buildQueryBody({
      target: { ...orders, partition: { name: "id", type: "N" }, sort: { name: "n", type: "N" } },
      draft: {
        ...emptyQueryDraft(),
        partition: "1E+2",
        useSort: true,
        sortOp: "=",
        sort: "12345678901234567890123456789012345678",
      },
      limit: 25,
      filters: [],
      filterJoiner: "and",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.body.key.pk.value).toEqual({ N: "1E+2" });
    expect(built.body.key.sk?.value).toEqual({ N: "12345678901234567890123456789012345678" });
  });

  it("rejects begins_with on a number and converts hex binary", () => {
    const message = queryFormMessage(
      { label: "Table", kind: "table", partition: { name: "id", type: "N" } },
      { ...emptyQueryDraft(), partition: "1", useSort: true, sortOp: "begins_with", sort: "1" },
    );
    expect(message).toBeUndefined();
    const sorted = queryFormMessage(
      {
        label: "Table",
        kind: "table",
        partition: { name: "id", type: "S" },
        sort: { name: "n", type: "N" },
      },
      { ...emptyQueryDraft(), partition: "a", useSort: true, sortOp: "begins_with", sort: "1E+2" },
    );
    expect(sorted).toMatch(/begins_with/);
    expect(hexToBase64("62")).toBe("Yg==");
    const binary = buildQueryBody({
      target: { label: "Table", kind: "table", partition: { name: "id", type: "B" } },
      draft: { ...emptyQueryDraft(), partition: "62", binaryEncoding: "hex" },
      limit: 10,
      filters: [],
      filterJoiner: "and",
    });
    expect(binary.ok && binary.body.key.pk.value).toEqual({ B: "Yg==" });
  });

  it("lists indexes and omits credentials from the CLI preview", () => {
    const targets = queryTargets({
      keySchema: [
        { name: "userId", type: "S", keyType: "HASH" },
        { name: "createdAt", type: "S", keyType: "RANGE" },
      ],
      gsis: [
        {
          name: "status-createdAt-index",
          keys: [
            { name: "status", type: "S", keyType: "HASH" },
            { name: "createdAt", type: "S", keyType: "RANGE" },
          ],
        },
      ],
      lsis: [],
    });
    expect(targets.map((target) => target.label)).toEqual(["Table", "status-createdAt-index"]);
    const command = awsQueryCommand({
      region: "us-east-1",
      endpoint: "http://127.0.0.1:8000",
      preview: {
        TableName: "orders",
        IndexName: gsi.index,
        KeyConditionExpression: "#n0 = :v0",
        ExpressionAttributeNames: { "#n0": "status" },
        ExpressionAttributeValues: { ":v0": { S: "SHIPPED" } },
        ScanIndexForward: false,
        Limit: 5,
      },
    });
    expect(command).toContain("--no-scan-index-forward");
    expect(command).toContain("status-createdAt-index");
    expect(command).not.toMatch(/secret|access-key|profile/iu);
  });
});
