import {
  IndexStatus,
  TableDescription,
  TableStatus,
  type TableDescription as TableDescriptionBody,
} from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";

interface RawKey {
  AttributeName?: string;
  KeyType?: string;
}

interface RawAttribute {
  AttributeName?: string;
  AttributeType?: string;
}

interface RawIndex {
  IndexName?: string;
  IndexStatus?: string;
  KeySchema?: RawKey[];
  Projection?: { ProjectionType?: string; NonKeyAttributes?: string[] };
  ProvisionedThroughput?: { ReadCapacityUnits?: number; WriteCapacityUnits?: number };
}

export interface RawTable {
  TableName?: string;
  TableStatus?: string;
  TableArn?: string;
  CreationDateTime?: Date;
  ItemCount?: number;
  TableSizeBytes?: number;
  DeletionProtectionEnabled?: boolean;
  BillingModeSummary?: { BillingMode?: string };
  ProvisionedThroughput?: { ReadCapacityUnits?: number; WriteCapacityUnits?: number };
  AttributeDefinitions?: RawAttribute[];
  KeySchema?: RawKey[];
  GlobalSecondaryIndexes?: RawIndex[];
  LocalSecondaryIndexes?: RawIndex[];
  StreamSpecification?: { StreamEnabled?: boolean; StreamViewType?: string };
}

export interface RawTtl {
  TimeToLiveStatus?: string;
  AttributeName?: string;
}

function attributeType(definitions: readonly RawAttribute[], name: string): "S" | "N" | "B" {
  const found = definitions.find((item) => item.AttributeName === name)?.AttributeType;
  if (found === "S" || found === "N" || found === "B") {
    return found;
  }
  throw new HttpError("VALIDATION", `Attribute ${name} has no S, N, or B type.`);
}

function keys(
  schema: readonly RawKey[] | undefined,
  definitions: readonly RawAttribute[],
): { name: string; type: "S" | "N" | "B"; keyType: "HASH" | "RANGE" }[] {
  const result: { name: string; type: "S" | "N" | "B"; keyType: "HASH" | "RANGE" }[] = [];
  for (const key of schema ?? []) {
    const keyType = key.KeyType;
    if (key.AttributeName === undefined || (keyType !== "HASH" && keyType !== "RANGE")) {
      continue;
    }
    result.push({
      name: key.AttributeName,
      type: attributeType(definitions, key.AttributeName),
      keyType,
    });
  }
  return result;
}

function projection(
  raw: RawIndex["Projection"],
): TableDescriptionBody["gsis"][number]["projection"] {
  if (raw?.ProjectionType === "KEYS_ONLY") {
    return { type: "KEYS_ONLY" };
  }
  if (raw?.ProjectionType === "INCLUDE") {
    const nonKeyAttributes = (raw.NonKeyAttributes ?? []).filter((name) => name.length > 0);
    if (nonKeyAttributes.length === 0) {
      throw new HttpError("VALIDATION", "An INCLUDE projection needs attributes.");
    }
    return { type: "INCLUDE", nonKeyAttributes };
  }
  return { type: "ALL" };
}

function indexStatus(value: string | undefined): TableDescriptionBody["gsis"][number]["status"] {
  const parsed = IndexStatus.safeParse(value ?? "ACTIVE");
  if (!parsed.success) {
    throw new HttpError("VALIDATION", "DynamoDB returned an unknown index status.");
  }
  return parsed.data;
}

function oneIndex(
  raw: RawIndex,
  definitions: readonly RawAttribute[],
): TableDescriptionBody["gsis"][number] {
  if (raw.IndexName === undefined) {
    throw new HttpError("VALIDATION", "DynamoDB returned an index without a name.");
  }
  const described: TableDescriptionBody["gsis"][number] = {
    name: raw.IndexName,
    status: indexStatus(raw.IndexStatus),
    keys: keys(raw.KeySchema, definitions),
    projection: projection(raw.Projection),
  };
  const rcu = raw.ProvisionedThroughput?.ReadCapacityUnits;
  const wcu = raw.ProvisionedThroughput?.WriteCapacityUnits;
  if (rcu !== undefined && rcu > 0) {
    described.rcu = rcu;
  }
  if (wcu !== undefined && wcu > 0) {
    described.wcu = wcu;
  }
  return described;
}

function billing(table: RawTable): TableDescriptionBody["billing"] {
  const mode = table.BillingModeSummary?.BillingMode;
  const rcu = table.ProvisionedThroughput?.ReadCapacityUnits;
  const wcu = table.ProvisionedThroughput?.WriteCapacityUnits;
  if (mode === "PROVISIONED" || (mode === undefined && (rcu ?? 0) > 0 && (wcu ?? 0) > 0)) {
    if (rcu === undefined || wcu === undefined || rcu <= 0 || wcu <= 0) {
      throw new HttpError("VALIDATION", "Provisioned capacity needs read and write units.");
    }
    return { mode: "PROVISIONED", rcu, wcu };
  }
  return { mode: "PAY_PER_REQUEST" };
}

function count(value: number | undefined): number {
  if (value === undefined || !Number.isSafeInteger(value) || value < 0) {
    return 0;
  }
  return value;
}

export function normalizeTable(table: RawTable, ttl: RawTtl): TableDescriptionBody {
  const name = table.TableName;
  const status = TableStatus.safeParse(table.TableStatus);
  if (name === undefined || !status.success || table.TableArn === undefined) {
    throw new HttpError("VALIDATION", "DynamoDB returned an incomplete table description.");
  }
  const definitions = table.AttributeDefinitions ?? [];
  const enabled = ttl.TimeToLiveStatus === "ENABLED" || ttl.TimeToLiveStatus === "ENABLING";
  const streamOn = table.StreamSpecification?.StreamEnabled === true;
  const viewType = table.StreamSpecification?.StreamViewType;
  const described = {
    name,
    status: status.data,
    arn: table.TableArn,
    keySchema: keys(table.KeySchema, definitions),
    attributeDefinitions: definitions.flatMap((item) => {
      if (
        item.AttributeName === undefined ||
        (item.AttributeType !== "S" && item.AttributeType !== "N" && item.AttributeType !== "B")
      ) {
        return [];
      }
      return [{ name: item.AttributeName, type: item.AttributeType }];
    }),
    billing: billing(table),
    itemCount: count(table.ItemCount),
    sizeBytes: count(table.TableSizeBytes),
    gsis: (table.GlobalSecondaryIndexes ?? []).map((index) => oneIndex(index, definitions)),
    lsis: (table.LocalSecondaryIndexes ?? []).map((index) => oneIndex(index, definitions)),
    ttl:
      enabled && ttl.AttributeName !== undefined
        ? { enabled: true as const, attribute: ttl.AttributeName }
        : { enabled: false as const },
    stream:
      streamOn &&
      (viewType === "NEW_IMAGE" ||
        viewType === "OLD_IMAGE" ||
        viewType === "NEW_AND_OLD_IMAGES" ||
        viewType === "KEYS_ONLY")
        ? { enabled: true as const, viewType }
        : { enabled: false as const },
    deletionProtection: table.DeletionProtectionEnabled === true,
    createdAt: (table.CreationDateTime ?? new Date(0)).toISOString(),
  };
  return TableDescription.parse(described);
}
