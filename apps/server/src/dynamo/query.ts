import { DescribeTableCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
  QueryRequestError,
  QueryResponse,
  buildKeyCondition,
  type AttributeValue,
  type BuiltKeyCondition,
  type Filter,
  type KeyAttribute,
  type KeySort,
  type QueryPreview,
  type QueryResponse as QueryResponseBody,
} from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import { HttpError } from "../http-error.js";
import { fromSdkItem, toSdkItem, toSdkValue, type SdkAttribute } from "./attribute-wire.js";
import { mapDynamoError } from "./error-mapper.js";
import { buildScanExpressions } from "./expression-builder.js";
import { decodeQueryCursor, encodeQueryCursor, type QueryCursorContext } from "./query-cursor.js";

const FILL_CALLS = 10;
const FILL_MS = 2_000;

export interface QueryTableInput {
  table: string;
  index?: string;
  partitionKey: KeyAttribute;
  sortKey?: KeySort;
  scanForward: boolean;
  limit: number;
  cursor?: string;
  filters?: readonly Filter[];
  filterJoiner: "and" | "or";
  projection?: readonly string[];
  consistentRead?: boolean;
  fillPage?: boolean;
  signal?: AbortSignal;
  now?: () => number;
}

interface BuiltQuery {
  key: BuiltKeyCondition;
  filterExpression?: string;
  projectionExpression?: string;
  names: Record<string, string>;
  values: Record<string, AttributeValue>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function cancelled(): Error {
  const error = new Error("The query was cancelled.");
  error.name = "AbortError";
  return error;
}

function topName(path: string): string {
  const cut = path.split(/[.[]/u, 1)[0];
  return cut ?? path;
}

function rejectKeyFilters(input: QueryTableInput): void {
  const keys = new Set(
    [input.partitionKey.name, input.sortKey?.name].filter((name) => name !== undefined),
  );
  for (const filter of input.filters ?? []) {
    if (keys.has(topName(filter.attribute))) {
      throw new HttpError(
        "VALIDATION",
        "Query filters cannot use key attributes. Put them in the key condition.",
      );
    }
  }
}

function shiftToken(expression: string, prefix: "#n" | ":v", offset: number): string {
  return expression.replace(
    new RegExp(`${prefix === "#n" ? "#n" : ":v"}(\\d+)`, "g"),
    (_match, digits: string) => {
      return `${prefix}${String(Number(digits) + offset)}`;
    },
  );
}

function shiftMap(
  map: Readonly<Record<string, string>>,
  prefix: "#n" | ":v",
  offset: number,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    next[shiftToken(key, prefix, offset)] = value;
  }
  return next;
}

function shiftValues(
  map: Readonly<Record<string, AttributeValue>>,
  offset: number,
): Record<string, AttributeValue> {
  const next: Record<string, AttributeValue> = {};
  for (const [key, value] of Object.entries(map)) {
    next[shiftToken(key, ":v", offset)] = value;
  }
  return next;
}

function buildQuery(input: QueryTableInput): BuiltQuery {
  let key: BuiltKeyCondition;
  try {
    key = buildKeyCondition({
      partitionKey: input.partitionKey,
      ...(input.sortKey === undefined ? {} : { sortKey: input.sortKey }),
    });
  } catch (error) {
    if (error instanceof QueryRequestError) {
      throw new HttpError("VALIDATION", error.message);
    }
    throw error;
  }
  const rest = buildScanExpressions({
    filters: input.filters ?? [],
    joiner: input.filterJoiner,
    ...(input.projection === undefined ? {} : { projection: input.projection }),
  });
  const nameOffset = Object.keys(key.names).length;
  const valueOffset = Object.keys(key.values).length;
  const names = {
    ...key.names,
    ...shiftMap(rest.names, "#n", nameOffset),
  };
  const values = {
    ...key.values,
    ...shiftValues(rest.values, valueOffset),
  };
  return {
    key,
    names,
    values,
    ...(rest.filterExpression === undefined
      ? {}
      : {
          filterExpression: shiftToken(
            shiftToken(rest.filterExpression, "#n", nameOffset),
            ":v",
            valueOffset,
          ),
        }),
    ...(rest.projectionExpression === undefined
      ? {}
      : {
          projectionExpression: shiftToken(rest.projectionExpression, "#n", nameOffset),
        }),
  };
}

function contextOf(input: QueryTableInput): QueryCursorContext {
  return {
    table: input.table,
    partitionKeyName: input.partitionKey.name,
    partitionKeyValue: input.partitionKey.value,
    scanForward: input.scanForward,
    filterJoiner: input.filterJoiner,
    ...(input.index === undefined ? {} : { index: input.index }),
    ...(input.sortKey === undefined ? {} : { sortKey: input.sortKey }),
    ...(input.filters === undefined ? {} : { filters: input.filters }),
    ...(input.projection === undefined ? {} : { projection: input.projection }),
    ...(input.consistentRead === undefined ? {} : { consistentRead: input.consistentRead }),
  };
}

function preview(input: QueryTableInput, built: BuiltQuery): QueryPreview {
  return {
    TableName: input.table,
    KeyConditionExpression: built.key.expression,
    ExpressionAttributeNames: built.names,
    ExpressionAttributeValues: built.values,
    ScanIndexForward: input.scanForward,
    Limit: input.limit,
    ...(input.index === undefined ? {} : { IndexName: input.index }),
    ...(built.projectionExpression === undefined
      ? {}
      : { ProjectionExpression: built.projectionExpression }),
    ...(built.filterExpression === undefined ? {} : { FilterExpression: built.filterExpression }),
    ...(input.consistentRead === true ? { ConsistentRead: true } : {}),
  };
}

async function assertGsiConsistent(
  client: DynamoCaller,
  endpoint: string,
  input: QueryTableInput,
): Promise<void> {
  if (input.consistentRead !== true || input.index === undefined) {
    return;
  }
  let result: unknown;
  try {
    result = await client.send(new DescribeTableCommand({ TableName: input.table }), {
      ...(input.signal === undefined ? {} : { abortSignal: input.signal }),
    });
  } catch (error) {
    throw mapped(error, endpoint);
  }
  const indexes = asRecord(asRecord(result)?.Table)?.GlobalSecondaryIndexes;
  if (!Array.isArray(indexes)) {
    return;
  }
  const match = indexes.some((index) => asRecord(index)?.IndexName === input.index);
  if (match) {
    throw new HttpError(
      "VALIDATION",
      "Consistent read is not available on a global secondary index.",
    );
  }
}

function mapped(error: unknown, endpoint: string): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  const result = mapDynamoError(error, endpoint.length === 0 ? undefined : endpoint);
  return new HttpError(result.code, result.message, {
    retryable: result.retryable,
    ...(result.details === undefined ? {} : { details: result.details }),
  });
}

function readCapacity(value: unknown): number | undefined {
  const capacity = asRecord(value);
  if (typeof capacity?.ReadCapacityUnits === "number") {
    return capacity.ReadCapacityUnits;
  }
  if (typeof capacity?.CapacityUnits === "number") {
    return capacity.CapacityUnits;
  }
  return undefined;
}

export async function queryTable(
  client: DynamoCaller,
  endpoint: string,
  input: QueryTableInput,
): Promise<QueryResponseBody> {
  rejectKeyFilters(input);
  await assertGsiConsistent(client, endpoint, input);
  const built = buildQuery(input);
  const context = contextOf(input);
  const now = input.now ?? Date.now;
  let exclusive =
    input.cursor === undefined ? undefined : toSdkItem(decodeQueryCursor(input.cursor, context));
  const started = now();
  const items: Array<Record<string, AttributeValue>> = [];
  let scannedCount = 0;
  let consumed = 0;
  let sawCapacity = false;
  let lek: Record<string, AttributeValue> | undefined;
  let calls = 0;
  while (items.length < input.limit) {
    if (input.signal?.aborted === true) {
      throw cancelled();
    }
    if (
      input.fillPage === true &&
      calls > 0 &&
      (calls >= FILL_CALLS || now() - started >= FILL_MS)
    ) {
      break;
    }
    const page = await readPage(client, endpoint, input, built, {
      limit: input.limit - items.length,
      ...(exclusive === undefined ? {} : { exclusive }),
    });
    calls += 1;
    items.push(...page.items);
    scannedCount += page.scannedCount;
    if (page.rcu !== undefined) {
      consumed += page.rcu;
      sawCapacity = true;
    }
    lek = page.lek;
    exclusive = lek === undefined ? undefined : toSdkItem(lek);
    if (input.fillPage !== true || lek === undefined) {
      break;
    }
  }
  const nextCursor = lek === undefined ? undefined : encodeQueryCursor(lek, context);
  return QueryResponse.parse({
    items,
    count: items.length,
    scannedCount,
    hasMore: nextCursor !== undefined,
    request: preview(input, built),
    ...(nextCursor === undefined ? {} : { nextCursor }),
    ...(sawCapacity ? { consumedCapacity: { rcu: consumed } } : {}),
  });
}

async function readPage(
  client: DynamoCaller,
  endpoint: string,
  input: QueryTableInput,
  built: BuiltQuery,
  page: { limit: number; exclusive?: Record<string, SdkAttribute> },
): Promise<{
  items: Array<Record<string, AttributeValue>>;
  scannedCount: number;
  lek?: Record<string, AttributeValue>;
  rcu?: number;
}> {
  if (input.signal?.aborted === true) {
    throw cancelled();
  }
  let result: unknown;
  try {
    result = await client.send(
      new QueryCommand({
        TableName: input.table,
        KeyConditionExpression: built.key.expression,
        ExpressionAttributeNames: built.names,
        Limit: page.limit,
        ScanIndexForward: input.scanForward,
        ReturnConsumedCapacity: "TOTAL",
        ...(input.index === undefined ? {} : { IndexName: input.index }),
        ...(input.consistentRead === true ? { ConsistentRead: true } : {}),
        ...(page.exclusive === undefined ? {} : { ExclusiveStartKey: page.exclusive }),
        ...(built.filterExpression === undefined
          ? {}
          : { FilterExpression: built.filterExpression }),
        ...(built.projectionExpression === undefined
          ? {}
          : { ProjectionExpression: built.projectionExpression }),
        ...(Object.keys(built.values).length === 0
          ? {}
          : {
              ExpressionAttributeValues: Object.fromEntries(
                Object.entries(built.values).map(([key, value]) => [key, toSdkValue(value)]),
              ),
            }),
      }),
      input.signal === undefined ? {} : { abortSignal: input.signal },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw cancelled();
    }
    throw mapped(error, endpoint);
  }
  const record = asRecord(result);
  const rawItems = Array.isArray(record?.Items) ? record.Items : [];
  const rawKey = record?.LastEvaluatedKey;
  const lek =
    typeof rawKey === "object" && rawKey !== null && !Array.isArray(rawKey)
      ? fromSdkItem(rawKey)
      : undefined;
  const rcu = readCapacity(record?.ConsumedCapacity);
  return {
    items: rawItems.map(fromSdkItem),
    scannedCount: typeof record?.ScannedCount === "number" ? record.ScannedCount : rawItems.length,
    ...(lek === undefined || Object.keys(lek).length === 0 ? {} : { lek }),
    ...(rcu === undefined ? {} : { rcu }),
  };
}
