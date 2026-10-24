import { z } from "zod";

export const TABLE_NAME_PATTERN = /^[A-Za-z0-9_.-]{3,255}$/;
export const TABLE_LIST_PAGE_MAX = 100;
export const TABLE_LIST_MAX_NAMES = 5000;

const tableName = z.string().regex(TABLE_NAME_PATTERN);
const attributeName = z.string().min(1).max(255);

export const TableStatus = z.enum([
  "CREATING",
  "UPDATING",
  "DELETING",
  "ACTIVE",
  "INACCESSIBLE_ENCRYPTION_CREDENTIALS",
  "ARCHIVING",
  "ARCHIVED",
  "REPLICATION_NOT_AUTHORIZED",
]);

export const IndexStatus = z.enum(["CREATING", "UPDATING", "DELETING", "ACTIVE"]);

const attributeType = z.enum(["S", "N", "B"]);

export const AttributeDefinition = z.strictObject({
  name: attributeName,
  type: attributeType,
});

export const KeyAttribute = z.strictObject({
  name: attributeName,
  type: attributeType,
  keyType: z.enum(["HASH", "RANGE"]),
});

export type KeyAttribute = z.infer<typeof KeyAttribute>;

function onePartitionKey(keys: readonly KeyAttribute[], ctx: z.RefinementCtx): void {
  const hashCount = keys.filter((key) => key.keyType === "HASH").length;
  const rangeCount = keys.filter((key) => key.keyType === "RANGE").length;
  if (hashCount !== 1 || rangeCount > 1) {
    ctx.addIssue({
      code: "custom",
      message: "A key schema needs one partition key and at most one sort key.",
    });
  }
}

const IndexProjection = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ALL") }),
  z.strictObject({ type: z.literal("KEYS_ONLY") }),
  z.strictObject({
    type: z.literal("INCLUDE"),
    nonKeyAttributes: z.array(attributeName).min(1).max(100),
  }),
]);

export const TableIndex = z.strictObject({
  name: tableName,
  status: IndexStatus,
  keys: z.array(KeyAttribute).min(1).max(2).superRefine(onePartitionKey),
  projection: IndexProjection,
  rcu: z.number().int().positive().optional(),
  wcu: z.number().int().positive().optional(),
});

export const TableBilling = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("PAY_PER_REQUEST") }),
  z.strictObject({
    mode: z.literal("PROVISIONED"),
    rcu: z.number().int().positive(),
    wcu: z.number().int().positive(),
  }),
]);

export const TableTtl = z
  .strictObject({
    enabled: z.boolean(),
    attribute: attributeName.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && value.attribute === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["attribute"],
        message: "An enabled TTL needs an attribute name.",
      });
    }
  });

export const TableStream = z
  .strictObject({
    enabled: z.boolean(),
    viewType: z.enum(["NEW_IMAGE", "OLD_IMAGE", "NEW_AND_OLD_IMAGES", "KEYS_ONLY"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.enabled && value.viewType === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["viewType"],
        message: "An enabled stream needs a view type.",
      });
    }
    if (!value.enabled && value.viewType !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["viewType"],
        message: "A disabled stream has no view type.",
      });
    }
  });

export const TableDescription = z.strictObject({
  name: tableName,
  status: TableStatus,
  arn: z.string().min(1),
  keySchema: z.array(KeyAttribute).min(1).max(2).superRefine(onePartitionKey),
  attributeDefinitions: z.array(AttributeDefinition).min(1),
  billing: TableBilling,
  itemCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  gsis: z.array(TableIndex),
  lsis: z.array(TableIndex),
  ttl: TableTtl,
  stream: TableStream,
  deletionProtection: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type TableDescription = z.infer<typeof TableDescription>;

export const TableListResponse = z.strictObject({
  tables: z.array(tableName),
  nextCursor: z.string().min(1).optional(),
});

export type TableListResponse = z.infer<typeof TableListResponse>;

export const TableListQuery = z.strictObject({
  search: z.string().trim().max(255).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(TABLE_LIST_PAGE_MAX).optional(),
});

export type TableListQuery = z.infer<typeof TableListQuery>;

export const TableWaitResponse = z.strictObject({
  status: TableStatus,
});

export type TableWaitResponse = z.infer<typeof TableWaitResponse>;
