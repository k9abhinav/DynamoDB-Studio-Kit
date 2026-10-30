import { CreateTableBody, type CreateTableBody as CreateBody } from "@dynamo-studio/shared";

export interface CreateDraft {
  name: string;
  partitionName: string;
  partitionType: "S" | "N" | "B";
  sortName: string;
  sortType: "S" | "N" | "B";
  billingMode: "PAY_PER_REQUEST" | "PROVISIONED";
  rcu: string;
  wcu: string;
  ttlAttribute: string;
  deletionProtection: boolean;
  gsiName: string;
  gsiPartitionName: string;
}

export const EMPTY_CREATE_DRAFT: CreateDraft = {
  name: "",
  partitionName: "",
  partitionType: "S",
  sortName: "",
  sortType: "S",
  billingMode: "PAY_PER_REQUEST",
  rcu: "1",
  wcu: "1",
  ttlAttribute: "",
  deletionProtection: false,
  gsiName: "",
  gsiPartitionName: "",
};

export function createBodyFromDraft(draft: CreateDraft): CreateBody {
  const sort = draft.sortName.trim();
  const ttl = draft.ttlAttribute.trim();
  const gsiName = draft.gsiName.trim();
  const gsiPartition = draft.gsiPartitionName.trim();
  return CreateTableBody.parse({
    name: draft.name.trim(),
    partitionKey: { name: draft.partitionName.trim(), type: draft.partitionType },
    ...(sort.length === 0 ? {} : { sortKey: { name: sort, type: draft.sortType } }),
    billing:
      draft.billingMode === "PAY_PER_REQUEST"
        ? { mode: "PAY_PER_REQUEST" }
        : { mode: "PROVISIONED", rcu: Number(draft.rcu), wcu: Number(draft.wcu) },
    ...(ttl.length === 0 ? {} : { ttlAttribute: ttl }),
    deletionProtection: draft.deletionProtection,
    ...(gsiName.length === 0 || gsiPartition.length === 0
      ? {}
      : {
          gsis: [
            {
              name: gsiName,
              partitionKey: { name: gsiPartition, type: "S" as const },
              projection: { type: "KEYS_ONLY" as const },
            },
          ],
        }),
  });
}
