import { BatchWriteItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import {
  IMPORT_BATCH_SIZE,
  SKIP_EXISTING_CONCURRENCY,
  canonicalTypedJson,
  extractKey,
  type Item,
  type ItemKeySpec,
} from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";
import { fromSdkItem, toSdkItem, toSdkValue } from "./attribute-wire.js";
import { mapDynamoError } from "./error-mapper.js";
import { checkImportItem, type ParsedImportRow } from "./import-parse.js";
import { buildWriteCondition } from "./item-condition.js";
import type { ItemScope } from "./items.js";

const MAX_ATTEMPTS = 8;

export interface ImportCounts {
  processed: number;
  written: number;
  skipped: number;
  failed: number;
  duplicates: number;
}

export interface ImportFailure {
  row: number;
  reason: string;
}

interface Pending {
  row: number;
  item: Item;
  key: string;
}

type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export async function* writeImport(input: {
  scope: ItemScope;
  keys: readonly ItemKeySpec[];
  mode: "put" | "skip-existing";
  dryRun: boolean;
  rows: AsyncIterable<ParsedImportRow> | Iterable<ParsedImportRow>;
  onFailure?: (failure: ImportFailure) => void;
  sleep?: Sleep;
}): AsyncGenerator<ImportCounts> {
  const counts: ImportCounts = { processed: 0, written: 0, skipped: 0, failed: 0, duplicates: 0 };
  const seen = new Set<string>();
  const writtenHere = new Set<string>();
  const batch = new Map<string, Pending>();
  const window: Pending[] = [];
  const sleep = input.sleep ?? delay;

  const fail = (row: number, reason: string): void => {
    counts.failed += 1;
    input.onFailure?.({ row, reason });
  };

  try {
    const rows = rowIterator(input.rows);
    let parsed = await readRow(rows);
    while (parsed !== undefined) {
      if (input.scope.signal?.aborted === true) {
        yield snapshot(counts);
        return;
      }
      counts.processed += 1;
      if (input.dryRun) {
        // Drop the row before the parser reads the next one, or each large
        // line stays reachable across that await and is promoted into old space.
        acceptRow(parsed, input.keys, seen, counts, fail);
        parsed = undefined;
        parsed = await readRow(rows);
        continue;
      }
      const pending = acceptRow(parsed, input.keys, seen, counts, fail);
      parsed = undefined;
      if (pending !== undefined && input.mode === "put") {
        batch.set(pending.key, pending);
        if (batch.size >= IMPORT_BATCH_SIZE) {
          await flushBatch(input.scope, input.keys, [...batch.values()], counts, fail, sleep);
          batch.clear();
          yield snapshot(counts);
        }
      } else if (pending !== undefined) {
        window.push(pending);
        if (window.length >= IMPORT_BATCH_SIZE) {
          await flushSkip(
            input.scope,
            input.keys,
            window.splice(0),
            writtenHere,
            counts,
            fail,
            sleep,
          );
          yield snapshot(counts);
        }
      }
      parsed = await readRow(rows);
    }
    if (!input.dryRun && input.mode === "put" && batch.size > 0) {
      await flushBatch(input.scope, input.keys, [...batch.values()], counts, fail, sleep);
    }
    if (!input.dryRun && window.length > 0) {
      await flushSkip(input.scope, input.keys, window.splice(0), writtenHere, counts, fail, sleep);
    }
  } catch (error) {
    if (!isAbort(error)) {
      throw error;
    }
  }
  yield snapshot(counts);
}

function rowIterator(
  rows: AsyncIterable<ParsedImportRow> | Iterable<ParsedImportRow>,
): AsyncIterator<ParsedImportRow> {
  const asyncRows = rows as AsyncIterable<ParsedImportRow>;
  if (typeof asyncRows[Symbol.asyncIterator] === "function") {
    return asyncRows[Symbol.asyncIterator]();
  }
  const sync = (rows as Iterable<ParsedImportRow>)[Symbol.iterator]();
  return {
    next(): Promise<IteratorResult<ParsedImportRow>> {
      return Promise.resolve(sync.next());
    },
  };
}

async function readRow(rows: AsyncIterator<ParsedImportRow>): Promise<ParsedImportRow | undefined> {
  const next = await rows.next();
  if (next.done === true) {
    return undefined;
  }
  return next.value;
}

function acceptRow(
  parsed: ParsedImportRow,
  keys: readonly ItemKeySpec[],
  seen: Set<string>,
  counts: ImportCounts,
  fail: (row: number, reason: string) => void,
): Pending | undefined {
  if (parsed.error !== undefined || parsed.item === undefined) {
    fail(parsed.row, parsed.error ?? "This row is not an item.");
    return undefined;
  }
  const problem = checkImportItem(parsed.item, keys);
  if (problem !== undefined) {
    fail(parsed.row, problem);
    return undefined;
  }
  const key = canonicalTypedJson(extractKey(parsed.item, keys));
  if (seen.has(key)) {
    counts.duplicates += 1;
  }
  seen.add(key);
  return { row: parsed.row, item: parsed.item, key };
}

async function flushBatch(
  scope: ItemScope,
  keys: readonly ItemKeySpec[],
  rows: readonly Pending[],
  counts: ImportCounts,
  fail: (row: number, reason: string) => void,
  sleep: Sleep,
): Promise<void> {
  let pending = [...rows];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && pending.length > 0; attempt += 1) {
    if (attempt > 0) {
      await sleep(jitter(attempt - 1), scope.signal);
    }
    throwIfAborted(scope.signal);
    try {
      const result = await send(
        scope,
        new BatchWriteItemCommand({
          RequestItems: {
            [scope.table]: pending.map((row) => ({ PutRequest: { Item: toSdkItem(row.item) } })),
          },
        }),
      );
      pending = unmatched(unprocessedPuts(result, scope.table), pending, keys);
    } catch (error) {
      if (isAbort(error)) {
        throw error;
      }
      if (error instanceof HttpError && error.retryable && attempt + 1 < MAX_ATTEMPTS) {
        continue;
      }
      const reason = error instanceof HttpError ? error.message : "DynamoDB rejected this item.";
      for (const row of pending) {
        fail(row.row, reason);
      }
      return;
    }
  }
  counts.written += rows.length - pending.length;
  for (const row of pending) {
    fail(row.row, "DynamoDB did not accept this item.");
  }
}

async function flushSkip(
  scope: ItemScope,
  keys: readonly ItemKeySpec[],
  rows: readonly Pending[],
  writtenHere: Set<string>,
  counts: ImportCounts,
  fail: (row: number, reason: string) => void,
  sleep: Sleep,
): Promise<void> {
  const tails = new Map<string, Promise<void>>();
  await mapLimit(rows, SKIP_EXISTING_CONCURRENCY, async (row) => {
    const previous = tails.get(row.key) ?? Promise.resolve();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    tails.set(row.key, gate);
    await previous;
    try {
      await putConditional(scope, keys, row, writtenHere, counts, fail, sleep);
    } finally {
      release();
    }
  });
}

async function putConditional(
  scope: ItemScope,
  keys: readonly ItemKeySpec[],
  row: Pending,
  writtenHere: Set<string>,
  counts: ImportCounts,
  fail: (row: number, reason: string) => void,
  sleep: Sleep,
): Promise<void> {
  const conditional = !writtenHere.has(row.key);
  const condition = buildWriteCondition({ mode: "create", keys, equality: false });
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(jitter(attempt - 1), scope.signal);
    }
    throwIfAborted(scope.signal);
    try {
      await send(
        scope,
        new PutItemCommand({
          TableName: scope.table,
          Item: toSdkItem(row.item),
          ...(conditional
            ? {
                ConditionExpression: condition.expression,
                ExpressionAttributeNames: condition.names,
                ...(Object.keys(condition.values).length === 0
                  ? {}
                  : {
                      ExpressionAttributeValues: Object.fromEntries(
                        Object.entries(condition.values).map(([name, value]) => [
                          name,
                          toSdkValue(value),
                        ]),
                      ),
                    }),
              }
            : {}),
        }),
      );
      counts.written += 1;
      writtenHere.add(row.key);
      return;
    } catch (error) {
      if (isAbort(error)) {
        throw error;
      }
      if (conditional && error instanceof HttpError && error.code === "CONDITION_FAILED") {
        counts.skipped += 1;
        return;
      }
      if (error instanceof HttpError && error.retryable && attempt + 1 < MAX_ATTEMPTS) {
        continue;
      }
      fail(row.row, error instanceof HttpError ? error.message : "DynamoDB rejected this item.");
      return;
    }
  }
}

function unmatched(
  items: readonly Item[],
  pending: readonly Pending[],
  keys: readonly ItemKeySpec[],
): Pending[] {
  const byKey = new Map(pending.map((row) => [row.key, row]));
  return items.flatMap((item) => {
    const row = byKey.get(canonicalTypedJson(extractKey(item, keys)));
    return row === undefined ? [] : [row];
  });
}

function unprocessedPuts(result: unknown, table: string): Item[] {
  const group = asRecord(asRecord(result)?.UnprocessedItems)?.[table];
  if (!Array.isArray(group)) {
    return [];
  }
  return group.flatMap((entry) => {
    const item = asRecord(asRecord(entry)?.PutRequest)?.Item;
    return isRecord(item) ? [fromSdkItem(item)] : [];
  });
}

function snapshot(counts: ImportCounts): ImportCounts {
  return { ...counts };
}

async function mapLimit<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const next = async (): Promise<void> => {
    const current = index;
    index += 1;
    const item = items[current];
    if (item === undefined) {
      return;
    }
    await worker(item);
    await next();
  };
  const runners = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: runners }, () => next()));
}

async function send(scope: ItemScope, command: { readonly input?: object }): Promise<unknown> {
  try {
    return await scope.client.send(
      command,
      scope.signal === undefined ? {} : { abortSignal: scope.signal },
    );
  } catch (error) {
    if (isAbort(error)) {
      throw error;
    }
    const mapped = mapDynamoError(error, scope.endpoint.length === 0 ? undefined : scope.endpoint);
    throw new HttpError(mapped.code, mapped.message, {
      retryable: mapped.retryable,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
    });
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    const error = new Error("Cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function jitter(attempt: number): number {
  const cap = Math.min(2000, 50 * 2 ** attempt);
  return Math.floor(Math.random() * cap);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(Object.assign(new Error("Cancelled."), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(Object.assign(new Error("Cancelled."), { name: "AbortError" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
