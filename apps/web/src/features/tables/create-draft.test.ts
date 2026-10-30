import { describe, expect, it } from "vitest";
import { createBodyFromDraft, EMPTY_CREATE_DRAFT } from "./create-draft.js";

describe("createBodyFromDraft", () => {
  it("builds an on-demand table and omits blank options", () => {
    expect(
      createBodyFromDraft({
        ...EMPTY_CREATE_DRAFT,
        name: "notes",
        partitionName: "id",
      }),
    ).toEqual({
      name: "notes",
      partitionKey: { name: "id", type: "S" },
      billing: { mode: "PAY_PER_REQUEST" },
      gsis: [],
      deletionProtection: false,
    });
  });

  it("includes a sort key, provisioned capacity, TTL, and one index", () => {
    const body = createBodyFromDraft({
      ...EMPTY_CREATE_DRAFT,
      name: "orders",
      partitionName: "userId",
      sortName: "createdAt",
      billingMode: "PROVISIONED",
      rcu: "5",
      wcu: "2",
      ttlAttribute: "expiresAt",
      deletionProtection: true,
      gsiName: "orders-status",
      gsiPartitionName: "status",
    });
    expect(body.sortKey).toEqual({ name: "createdAt", type: "S" });
    expect(body.billing).toEqual({ mode: "PROVISIONED", rcu: 5, wcu: 2 });
    expect(body.ttlAttribute).toBe("expiresAt");
    expect(body.gsis[0]?.name).toBe("orders-status");
    expect(body.deletionProtection).toBe(true);
  });
});
