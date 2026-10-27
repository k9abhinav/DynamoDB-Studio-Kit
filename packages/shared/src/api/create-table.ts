import { z } from "zod";
import { TABLE_NAME_PATTERN, TableBilling } from "./table.js";

const tableName = z.string().regex(TABLE_NAME_PATTERN);
const attributeName = z.string().min(1).max(255);
const keyType = z.enum(["S", "N", "B"]);
const capacity = z.number().int().positive();

export const GSI_LIMIT = 20;

export const KeyField = z.strictObject({
  name: attributeName,
  type: keyType,
});

export type KeyField = z.infer<typeof KeyField>;

export const IndexProjectionInput = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ALL") }),
  z.strictObject({ type: z.literal("KEYS_ONLY") }),
  z.strictObject({
    type: z.literal("INCLUDE"),
    attributes: z.array(attributeName).min(1).max(100),
  }),
]);

export const GsiInput = z.strictObject({
  name: tableName,
  partitionKey: KeyField,
  sortKey: KeyField.optional(),
  projection: IndexProjectionInput,
  rcu: capacity.optional(),
  wcu: capacity.optional(),
});

export type GsiInput = z.infer<typeof GsiInput>;

type KeyTypeName = z.infer<typeof keyType>;

function checkPair(
  partitionKey: KeyField,
  sortKey: KeyField | undefined,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  if (sortKey !== undefined && sortKey.name === partitionKey.name) {
    ctx.addIssue({
      code: "custom",
      path: [...path, "sortKey", "name"],
      message: "The sort key needs a different name from the partition key.",
    });
  }
}

function rememberType(
  seen: Map<string, KeyTypeName>,
  field: KeyField,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  const existing = seen.get(field.name);
  if (existing === undefined) {
    seen.set(field.name, field.type);
    return;
  }
  if (existing !== field.type) {
    ctx.addIssue({
      code: "custom",
      path,
      message: `${field.name} is already type ${existing}.`,
    });
  }
}

function checkCapacity(
  gsi: GsiInput,
  onDemand: boolean,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  const partial = (gsi.rcu === undefined) !== (gsi.wcu === undefined);
  if (partial) {
    ctx.addIssue({
      code: "custom",
      path,
      message: "Set both read and write capacity, or neither.",
    });
  }
  if (onDemand && (gsi.rcu !== undefined || gsi.wcu !== undefined)) {
    ctx.addIssue({
      code: "custom",
      path,
      message: "On-demand indexes do not take capacity.",
    });
  }
}

export const CreateTableBody = z
  .strictObject({
    name: tableName,
    partitionKey: KeyField,
    sortKey: KeyField.optional(),
    billing: TableBilling.default({ mode: "PAY_PER_REQUEST" }),
    gsis: z.array(GsiInput).max(GSI_LIMIT).default([]),
    ttlAttribute: attributeName.optional(),
    deletionProtection: z.boolean().default(false),
  })
  .superRefine((body, ctx) => {
    const types = new Map<string, KeyTypeName>();
    const indexNames = new Set<string>();
    checkPair(body.partitionKey, body.sortKey, ctx, []);
    rememberType(types, body.partitionKey, ctx, ["partitionKey"]);
    if (body.sortKey !== undefined) {
      rememberType(types, body.sortKey, ctx, ["sortKey"]);
    }
    body.gsis.forEach((gsi, index) => {
      if (indexNames.has(gsi.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["gsis", index, "name"],
          message: "Index names must be unique.",
        });
      }
      indexNames.add(gsi.name);
      checkPair(gsi.partitionKey, gsi.sortKey, ctx, ["gsis", index]);
      rememberType(types, gsi.partitionKey, ctx, ["gsis", index, "partitionKey"]);
      if (gsi.sortKey !== undefined) {
        rememberType(types, gsi.sortKey, ctx, ["gsis", index, "sortKey"]);
      }
      checkCapacity(gsi, body.billing.mode === "PAY_PER_REQUEST", ctx, ["gsis", index]);
    });
    const ttlType = body.ttlAttribute === undefined ? undefined : types.get(body.ttlAttribute);
    if (ttlType !== undefined && ttlType !== "N") {
      ctx.addIssue({
        code: "custom",
        path: ["ttlAttribute"],
        message: "A TTL attribute that is also a key must be a number.",
      });
    }
  });

export type CreateTableBody = z.infer<typeof CreateTableBody>;

export const TtlUpdate = z
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

export const UpdateTableBody = z
  .strictObject({
    billing: TableBilling.optional(),
    ttl: TtlUpdate.optional(),
    deletionProtection: z.boolean().optional(),
    gsiCreate: GsiInput.optional(),
    gsiDelete: tableName.optional(),
  })
  .superRefine((body, ctx) => {
    const present = [
      body.billing,
      body.ttl,
      body.deletionProtection,
      body.gsiCreate,
      body.gsiDelete,
    ].filter((value) => value !== undefined);
    if (present.length === 0) {
      ctx.addIssue({ code: "custom", message: "Choose a setting to change." });
    }
    if (body.gsiCreate !== undefined && body.gsiDelete !== undefined) {
      ctx.addIssue({ code: "custom", message: "Change one index at a time." });
    }
    if (body.gsiCreate !== undefined) {
      checkPair(body.gsiCreate.partitionKey, body.gsiCreate.sortKey, ctx, ["gsiCreate"]);
      checkCapacity(body.gsiCreate, false, ctx, ["gsiCreate"]);
    }
  });

export type UpdateTableBody = z.infer<typeof UpdateTableBody>;
