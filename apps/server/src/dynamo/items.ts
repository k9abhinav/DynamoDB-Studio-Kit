import { DeleteItemCommand, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  estimateItemSize,
  extractKey,
  itemHash,
  validateTypedItem,
  type Item,
  type ItemKeySpec,
} from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";
import type { DynamoCaller } from "../services/credentials.js";
import { fromSdkItem, toSdkItem } from "./attribute-wire.js";
import { mapDynamoError } from "./error-mapper.js";
import { buildWriteCondition, type WriteCondition } from "./item-condition.js";
import { describeConnectionTable } from "./table-api.js";

const EQUALITY_ATTRIBUTES = 150;
const EQUALITY_BYTES = 32 * 1024;

export interface ItemWriteResult {
  readonly item: Item;
  readonly hash: string;
  readonly weakConcurrency?: true;
}

export interface ItemScope {
  readonly client: DynamoCaller;
  readonly endpoint: string;
  readonly table: string;
  readonly signal?: AbortSignal;
}

export async function getItem(scope: ItemScope, key: Item): Promise<Item | null> {
  return load(scope, key);
}

export async function putItem(
  scope: ItemScope,
  input: { item: Item; ifNotExists?: boolean; expectedHash?: string },
): Promise<ItemWriteResult> {
  const keys = await keySpecs(scope);
  assertValid(input.item, keys);
  const current = await load(scope, extractKey(input.item, keys));
  await assertHash(current, input.expectedHash);
  const creating = input.ifNotExists === true;
  if (creating && current !== null) {
    throw new HttpError("CONDITION_FAILED", "An item with this key already exists.");
  }
  return replace(scope, input.item, keys, current, creating, input.expectedHash);
}

export async function updateItem(
  scope: ItemScope,
  input: { key: Item; item: Item; expectedHash?: string },
): Promise<ItemWriteResult> {
  const keys = await keySpecs(scope);
  assertValid(input.item, keys, input.key);
  const current = await load(scope, input.key);
  await assertHash(current, input.expectedHash);
  return replace(scope, input.item, keys, current, false, input.expectedHash);
}

export async function deleteItem(
  scope: ItemScope,
  input: { key: Item; expectedHash?: string },
): Promise<{ deleted: boolean; previousItem?: Item }> {
  if (input.expectedHash !== undefined) {
    await assertHash(await load(scope, input.key), input.expectedHash);
  }
  const result = await send(
    scope,
    new DeleteItemCommand({
      TableName: scope.table,
      Key: toSdkItem(input.key),
      ReturnValues: "ALL_OLD",
    }),
  );
  const attributes = asRecord(result)?.Attributes;
  if (!isRecord(attributes) || Object.keys(attributes).length === 0) {
    return { deleted: false };
  }
  return { deleted: true, previousItem: fromSdkItem(attributes) };
}

async function replace(
  scope: ItemScope,
  item: Item,
  keys: readonly ItemKeySpec[],
  current: Item | null,
  creating: boolean,
  expectedHash: string | undefined,
): Promise<ItemWriteResult> {
  const equality =
    !creating &&
    current !== null &&
    expectedHash !== undefined &&
    Object.keys(current).length <= EQUALITY_ATTRIBUTES &&
    estimateItemSize(current) <= EQUALITY_BYTES;
  const condition = buildWriteCondition({
    mode: creating ? "create" : "replace",
    keys,
    ...(current === null ? {} : { previous: current }),
    equality,
  });
  await write(scope, item, condition, creating);
  // DynamoDB rewrites number text (1E+2 becomes 100). Hash the stored item.
  const stored = await load(scope, extractKey(item, keys));
  const returned = stored ?? item;
  return {
    item: returned,
    hash: await itemHash(returned),
    ...(condition.weak ? { weakConcurrency: true as const } : {}),
  };
}

async function write(
  scope: ItemScope,
  item: Item,
  condition: WriteCondition,
  creating: boolean,
): Promise<void> {
  const values = toSdkItem(condition.values);
  try {
    await send(
      scope,
      new PutItemCommand({
        TableName: scope.table,
        Item: toSdkItem(item),
        ConditionExpression: condition.expression,
        ExpressionAttributeNames: { ...condition.names },
        ...(Object.keys(values).length === 0 ? {} : { ExpressionAttributeValues: values }),
      }),
    );
  } catch (error) {
    if (creating && error instanceof HttpError && error.code === "CONDITION_FAILED") {
      throw new HttpError("CONDITION_FAILED", "An item with this key already exists.");
    }
    throw error;
  }
}

function assertValid(item: Item, keys: readonly ItemKeySpec[], original?: Item): void {
  const issues = validateTypedItem(item, {
    keys,
    ...(original === undefined ? {} : { original }),
  }).filter((issue) => issue.severity === "error");
  const first = issues[0];
  if (first === undefined) {
    return;
  }
  if (issues.length === 1 && first.message.includes("400 KB")) {
    throw new HttpError("LIMIT_EXCEEDED", first.message);
  }
  throw new HttpError("VALIDATION", first.message, {
    details: {
      fields: issues.map((issue) => ({
        path: issue.path.length === 0 ? "item" : issue.path,
        message: issue.message,
      })),
    },
  });
}

async function assertHash(current: Item | null, expectedHash: string | undefined): Promise<void> {
  if (expectedHash === undefined) {
    return;
  }
  if (current === null || (await itemHash(current)) !== expectedHash) {
    throw new HttpError("CONDITION_FAILED", "This item changed since you opened it.");
  }
}

async function keySpecs(scope: ItemScope): Promise<ItemKeySpec[]> {
  const described = await describeConnectionTable(
    scope.client,
    scope.endpoint,
    scope.table,
    scope.signal,
  );
  return described.keySchema.map((key) => ({ name: key.name, type: key.type }));
}

async function load(scope: ItemScope, key: Item): Promise<Item | null> {
  const result = await send(
    scope,
    new GetItemCommand({
      TableName: scope.table,
      Key: toSdkItem(key),
      ConsistentRead: true,
    }),
  );
  const raw = asRecord(result)?.Item;
  if (!isRecord(raw)) {
    return null;
  }
  return fromSdkItem(raw);
}

async function send(scope: ItemScope, command: { readonly input?: object }): Promise<unknown> {
  try {
    return await scope.client.send(
      command,
      scope.signal === undefined ? {} : { abortSignal: scope.signal },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const cancelled = new Error("Cancelled.");
      cancelled.name = "AbortError";
      throw cancelled;
    }
    if (error instanceof HttpError) {
      throw error;
    }
    const mapped = mapDynamoError(error, scope.endpoint.length === 0 ? undefined : scope.endpoint);
    throw new HttpError(mapped.code, mapped.message, {
      retryable: mapped.retryable,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
    });
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    return value;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
