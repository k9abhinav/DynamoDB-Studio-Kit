import { z } from "zod";
import { CreateTableBody, type GsiInput, type KeyField } from "./create-table.js";
import { TABLE_NAME_PATTERN } from "./table.js";

const tableName = z.string().regex(TABLE_NAME_PATTERN);
const attributeName = z.string().min(1).max(255);
const keyType = z.enum(["S", "N", "B"]);
const capacity = z.number().int().positive();

const KeySchemaElement = z.strictObject({
  AttributeName: attributeName,
  KeyType: z.enum(["HASH", "RANGE"]),
});

const Throughput = z.strictObject({
  ReadCapacityUnits: capacity,
  WriteCapacityUnits: capacity,
});

const ProjectionPreview = z.union([
  z.strictObject({ ProjectionType: z.literal("ALL") }),
  z.strictObject({ ProjectionType: z.literal("KEYS_ONLY") }),
  z.strictObject({
    ProjectionType: z.literal("INCLUDE"),
    NonKeyAttributes: z.array(attributeName).min(1),
  }),
]);

const GsiPreview = z.strictObject({
  IndexName: tableName,
  KeySchema: z.array(KeySchemaElement).min(1).max(2),
  Projection: ProjectionPreview,
  ProvisionedThroughput: Throughput.optional(),
});

export const CreateTablePreview = z.strictObject({
  createTable: z.strictObject({
    TableName: tableName,
    AttributeDefinitions: z
      .array(z.strictObject({ AttributeName: attributeName, AttributeType: keyType }))
      .min(1),
    KeySchema: z.array(KeySchemaElement).min(1).max(2),
    BillingMode: z.enum(["PAY_PER_REQUEST", "PROVISIONED"]),
    ProvisionedThroughput: Throughput.optional(),
    GlobalSecondaryIndexes: z.array(GsiPreview).min(1).optional(),
    DeletionProtectionEnabled: z.boolean(),
  }),
  updateTimeToLive: z
    .strictObject({
      TableName: tableName,
      TimeToLiveSpecification: z.strictObject({
        Enabled: z.literal(true),
        AttributeName: attributeName,
      }),
    })
    .optional(),
});

export type CreateTablePreview = z.infer<typeof CreateTablePreview>;

function keySchema(partitionKey: KeyField, sortKey: KeyField | undefined) {
  const schema = [{ AttributeName: partitionKey.name, KeyType: "HASH" as const }];
  if (sortKey === undefined) {
    return schema;
  }
  return [...schema, { AttributeName: sortKey.name, KeyType: "RANGE" as const }];
}

function projectionOf(projection: GsiInput["projection"]) {
  if (projection.type === "INCLUDE") {
    return { ProjectionType: "INCLUDE" as const, NonKeyAttributes: projection.attributes };
  }
  if (projection.type === "KEYS_ONLY") {
    return { ProjectionType: "KEYS_ONLY" as const };
  }
  return { ProjectionType: "ALL" as const };
}

function pushAttribute(
  definitions: { AttributeName: string; AttributeType: KeyField["type"] }[],
  seen: Set<string>,
  field: KeyField,
): void {
  if (seen.has(field.name)) {
    return;
  }
  seen.add(field.name);
  definitions.push({ AttributeName: field.name, AttributeType: field.type });
}

/** AWS CreateTable input, plus TTL when set. No endpoint and no credentials. */
export function buildCreateTableRequest(input: unknown): CreateTablePreview {
  const body = CreateTableBody.parse(input);
  const definitions: { AttributeName: string; AttributeType: KeyField["type"] }[] = [];
  const seen = new Set<string>();
  pushAttribute(definitions, seen, body.partitionKey);
  if (body.sortKey !== undefined) {
    pushAttribute(definitions, seen, body.sortKey);
  }
  for (const gsi of body.gsis) {
    pushAttribute(definitions, seen, gsi.partitionKey);
    if (gsi.sortKey !== undefined) {
      pushAttribute(definitions, seen, gsi.sortKey);
    }
  }
  const billing = body.billing;
  const createTable = {
    TableName: body.name,
    AttributeDefinitions: definitions,
    KeySchema: keySchema(body.partitionKey, body.sortKey),
    BillingMode: billing.mode,
    DeletionProtectionEnabled: body.deletionProtection,
    ...(billing.mode === "PROVISIONED"
      ? {
          ProvisionedThroughput: {
            ReadCapacityUnits: billing.rcu,
            WriteCapacityUnits: billing.wcu,
          },
        }
      : {}),
    ...(body.gsis.length === 0
      ? {}
      : {
          GlobalSecondaryIndexes: body.gsis.map((gsi) => {
            const index = {
              IndexName: gsi.name,
              KeySchema: keySchema(gsi.partitionKey, gsi.sortKey),
              Projection: projectionOf(gsi.projection),
            };
            if (billing.mode !== "PROVISIONED") {
              return index;
            }
            return {
              ...index,
              ProvisionedThroughput: {
                ReadCapacityUnits: gsi.rcu ?? billing.rcu,
                WriteCapacityUnits: gsi.wcu ?? billing.wcu,
              },
            };
          }),
        }),
  };
  if (body.ttlAttribute === undefined) {
    return CreateTablePreview.parse({ createTable });
  }
  return CreateTablePreview.parse({
    createTable,
    updateTimeToLive: {
      TableName: body.name,
      TimeToLiveSpecification: { Enabled: true, AttributeName: body.ttlAttribute },
    },
  });
}
