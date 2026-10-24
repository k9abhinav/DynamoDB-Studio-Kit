import { ScanCommand } from "@aws-sdk/client-dynamodb";
import {
  ScanResponse,
  type AttributeValue,
  type Filter,
  type ScanResponse as ScanResponseBody,
} from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import { HttpError } from "../http-error.js";
import { fromSdkItem, toSdkItem, toSdkValue, type SdkAttribute } from "./attribute-wire.js";
import { mapDynamoError } from "./error-mapper.js";
import { buildScanExpressions } from "./expression-builder.js";
import { decodeScanCursor, encodeScanCursor, type ScanCursorContext } from "./scan-cursor.js";

const FILL_CALLS = 10;
const FILL_MS = 2_000;

export interface ScanTableInput {
  table: string;
  index?: string;
  limit: number;
  cursor?: string;
  filters?: readonly Filter[];
  filterJoiner: "and" | "or";
  projection?: readonly string[];
  consistentRead?: boolean;
  segment?: { index: number; total: number };
  fillPage?: boolean;
  signal?: AbortSignal;
  now?: () => number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function cancelled(): Error {
  const error = new Error("The scan was cancelled.");
  error.name = "AbortError";
  return error;
}

function contextOf(input: ScanTableInput): ScanCursorContext {
  return {
    table: input.table,
    filterJoiner: input.filterJoiner,
    ...(input.index === undefined ? {} : { index: input.index }),
    ...(input.filters === undefined ? {} : { filters: input.filters }),
    ...(input.projection === undefined ? {} : { projection: input.projection }),
    ...(input.consistentRead === undefined ? {} : { consistentRead: input.consistentRead }),
  };
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

export async function scanTable(
  client: DynamoCaller,
  endpoint: string,
  input: ScanTableInput,
): Promise<ScanResponseBody> {
  const now = input.now ?? Date.now;
  const context = contextOf(input);
  const expressions = buildScanExpressions({
    filters: input.filters ?? [],
    joiner: input.filterJoiner,
    ...(input.projection === undefined ? {} : { projection: input.projection }),
  });
  let exclusive =
    input.cursor === undefined ? undefined : toSdkItem(decodeScanCursor(input.cursor, context));
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
    const page = await readPage(client, endpoint, input, expressions, {
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

  const nextCursor = lek === undefined ? undefined : encodeScanCursor(lek, context);
  return ScanResponse.parse({
    items,
    count: items.length,
    scannedCount,
    hasMore: nextCursor !== undefined,
    ...(nextCursor === undefined ? {} : { nextCursor }),
    ...(sawCapacity ? { consumedCapacity: { rcu: consumed } } : {}),
  });
}

async function readPage(
  client: DynamoCaller,
  endpoint: string,
  input: ScanTableInput,
  expressions: ReturnType<typeof buildScanExpressions>,
  page: {
    limit: number;
    exclusive?: Record<string, SdkAttribute>;
  },
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
      new ScanCommand({
        TableName: input.table,
        Limit: page.limit,
        ReturnConsumedCapacity: "TOTAL",
        ...(input.index === undefined ? {} : { IndexName: input.index }),
        ...(input.consistentRead === true ? { ConsistentRead: true } : {}),
        ...(input.segment === undefined
          ? {}
          : { Segment: input.segment.index, TotalSegments: input.segment.total }),
        ...(page.exclusive === undefined ? {} : { ExclusiveStartKey: page.exclusive }),
        ...(expressions.filterExpression === undefined
          ? {}
          : { FilterExpression: expressions.filterExpression }),
        ...(expressions.projectionExpression === undefined
          ? {}
          : { ProjectionExpression: expressions.projectionExpression }),
        ...(Object.keys(expressions.names).length === 0
          ? {}
          : { ExpressionAttributeNames: expressions.names }),
        ...(Object.keys(expressions.values).length === 0
          ? {}
          : {
              ExpressionAttributeValues: Object.fromEntries(
                Object.entries(expressions.values).map(([key, value]) => [key, toSdkValue(value)]),
              ),
            }),
      }),
      input.signal === undefined ? {} : { abortSignal: input.signal },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw cancelled();
    }
    if (error instanceof HttpError) {
      throw error;
    }
    const mapped = mapDynamoError(error, endpoint.length === 0 ? undefined : endpoint);
    throw new HttpError(mapped.code, mapped.message, {
      retryable: mapped.retryable,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
    });
  }
  const record = asRecord(result);
  const rawItems = record?.Items;
  const rawItemsList = Array.isArray(rawItems) ? rawItems : [];
  const rawKey = record?.LastEvaluatedKey;
  const lek = isItem(rawKey) ? fromSdkItem(rawKey) : undefined;
  const rcu = readCapacity(record?.ConsumedCapacity);
  return {
    items: rawItemsList.map(fromSdkItem),
    scannedCount:
      typeof record?.ScannedCount === "number" ? record.ScannedCount : rawItemsList.length,
    ...(lek === undefined || Object.keys(lek).length === 0 ? {} : { lek }),
    ...(rcu === undefined ? {} : { rcu }),
  };
}

function isItem(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
