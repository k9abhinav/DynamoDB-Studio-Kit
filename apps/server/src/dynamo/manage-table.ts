import {
  CreateTableCommand,
  DeleteTableCommand,
  UpdateTableCommand,
  UpdateTimeToLiveCommand,
  type AttributeDefinition,
  type GlobalSecondaryIndexUpdate,
  type UpdateTableCommandInput,
} from "@aws-sdk/client-dynamodb";
import {
  GSI_LIMIT,
  type CreateTableBody,
  type GsiInput,
  type TableDescription,
  type UpdateTableBody,
  buildCreateTableRequest,
} from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import { mapDynamoError } from "./error-mapper.js";
import { HttpError } from "../http-error.js";
import { describeConnectionTable, waitForActiveTable } from "./table-api.js";

export function assertNameConfirm(confirm: string, table: string): void {
  if (confirm !== table) {
    throw new HttpError("VALIDATION", "Type the table name to confirm.");
  }
}

export function assertIndexesSettled(table: TableDescription): void {
  const busy = table.gsis.find((gsi) => gsi.status !== "ACTIVE");
  if (busy !== undefined) {
    throw new HttpError(
      "VALIDATION",
      `Wait until ${busy.name} is ACTIVE. DynamoDB changes one index at a time.`,
    );
  }
}

async function send(
  client: DynamoCaller,
  command: { readonly input?: object },
  endpoint: string,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    return await client.send(command, signal === undefined ? {} : { abortSignal: signal });
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    const mapped = mapDynamoError(error, endpoint.length === 0 ? undefined : endpoint);
    throw new HttpError(mapped.code, mapped.message, {
      retryable: mapped.retryable,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
    });
  }
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

function mergedDefinitions(table: TableDescription, gsi: GsiInput): AttributeDefinition[] {
  const definitions: AttributeDefinition[] = table.attributeDefinitions.map((attribute) => ({
    AttributeName: attribute.name,
    AttributeType: attribute.type,
  }));
  const fields = [gsi.partitionKey, ...(gsi.sortKey === undefined ? [] : [gsi.sortKey])];
  for (const field of fields) {
    const existing = definitions.find((attribute) => attribute.AttributeName === field.name);
    if (existing === undefined) {
      definitions.push({ AttributeName: field.name, AttributeType: field.type });
      continue;
    }
    const currentType = existing.AttributeType ?? "unknown";
    if (currentType !== field.type) {
      throw new HttpError("VALIDATION", `${field.name} is already type ${currentType}.`);
    }
  }
  return definitions;
}

function gsiCreateUpdate(
  table: TableDescription,
  gsi: GsiInput,
  billing: TableDescription["billing"],
): GlobalSecondaryIndexUpdate {
  if (
    table.gsis.some((index) => index.name === gsi.name) ||
    table.lsis.some((index) => index.name === gsi.name)
  ) {
    throw new HttpError("VALIDATION", "That index name is already in use.");
  }
  if (table.gsis.length >= GSI_LIMIT) {
    throw new HttpError("VALIDATION", `A table can have at most ${String(GSI_LIMIT)} indexes.`);
  }
  const throughput =
    billing.mode === "PAY_PER_REQUEST"
      ? undefined
      : {
          ReadCapacityUnits: gsi.rcu ?? billing.rcu,
          WriteCapacityUnits: gsi.wcu ?? billing.wcu,
        };
  if (billing.mode === "PAY_PER_REQUEST" && (gsi.rcu !== undefined || gsi.wcu !== undefined)) {
    throw new HttpError("VALIDATION", "On-demand indexes do not take capacity.");
  }
  return {
    Create: {
      IndexName: gsi.name,
      KeySchema: [
        { AttributeName: gsi.partitionKey.name, KeyType: "HASH" },
        ...(gsi.sortKey === undefined
          ? []
          : [{ AttributeName: gsi.sortKey.name, KeyType: "RANGE" as const }]),
      ],
      Projection: projectionOf(gsi.projection),
      ...(throughput === undefined ? {} : { ProvisionedThroughput: throughput }),
    },
  };
}

function updateInput(
  table: string,
  current: TableDescription,
  body: UpdateTableBody,
): UpdateTableCommandInput | undefined {
  const billing = body.billing ?? current.billing;
  const input: UpdateTableCommandInput = { TableName: table };
  let changed = false;
  if (body.billing?.mode === "PAY_PER_REQUEST") {
    input.BillingMode = "PAY_PER_REQUEST";
    changed = true;
  }
  if (body.billing?.mode === "PROVISIONED") {
    input.BillingMode = "PROVISIONED";
    input.ProvisionedThroughput = {
      ReadCapacityUnits: body.billing.rcu,
      WriteCapacityUnits: body.billing.wcu,
    };
    changed = true;
  }
  if (body.deletionProtection !== undefined) {
    input.DeletionProtectionEnabled = body.deletionProtection;
    changed = true;
  }
  if (body.gsiDelete !== undefined) {
    if (!current.gsis.some((index) => index.name === body.gsiDelete)) {
      throw new HttpError("NOT_FOUND", "That index doesn't exist.");
    }
    input.GlobalSecondaryIndexUpdates = [{ Delete: { IndexName: body.gsiDelete } }];
    changed = true;
  }
  if (body.gsiCreate !== undefined) {
    input.AttributeDefinitions = mergedDefinitions(current, body.gsiCreate);
    input.GlobalSecondaryIndexUpdates = [gsiCreateUpdate(current, body.gsiCreate, billing)];
    changed = true;
  }
  return changed ? input : undefined;
}

export async function createConnectionTable(
  client: DynamoCaller,
  endpoint: string,
  body: CreateTableBody,
  signal?: AbortSignal,
): Promise<TableDescription> {
  const preview = buildCreateTableRequest(body);
  await send(client, new CreateTableCommand(preview.createTable), endpoint, signal);
  const waited = await waitForActiveTable(client, endpoint, body.name, signal);
  if (preview.updateTimeToLive !== undefined && waited.status === "ACTIVE") {
    await send(client, new UpdateTimeToLiveCommand(preview.updateTimeToLive), endpoint, signal);
  }
  return describeConnectionTable(client, endpoint, body.name, signal);
}

export async function updateConnectionTable(
  client: DynamoCaller,
  endpoint: string,
  table: string,
  body: UpdateTableBody,
  signal?: AbortSignal,
): Promise<TableDescription> {
  const current = await describeConnectionTable(client, endpoint, table, signal);
  const changesTable =
    body.billing !== undefined ||
    body.deletionProtection !== undefined ||
    body.gsiCreate !== undefined ||
    body.gsiDelete !== undefined;
  if (changesTable) {
    assertIndexesSettled(current);
  }
  const input = updateInput(table, current, body);
  if (input !== undefined) {
    await send(client, new UpdateTableCommand(input), endpoint, signal);
  }
  if (body.ttl !== undefined) {
    const attribute = body.ttl.attribute ?? current.ttl.attribute;
    if (attribute === undefined) {
      throw new HttpError("VALIDATION", "Name the TTL attribute.");
    }
    await send(
      client,
      new UpdateTimeToLiveCommand({
        TableName: table,
        TimeToLiveSpecification: { Enabled: body.ttl.enabled, AttributeName: attribute },
      }),
      endpoint,
      signal,
    );
  }
  return describeConnectionTable(client, endpoint, table, signal);
}

export async function deleteConnectionTable(
  client: DynamoCaller,
  endpoint: string,
  table: string,
  signal?: AbortSignal,
): Promise<void> {
  await send(client, new DeleteTableCommand({ TableName: table }), endpoint, signal);
}
