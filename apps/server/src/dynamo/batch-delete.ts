import { BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { canonicalTypedJson, type Item } from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";
import { fromSdkItem, toSdkItem } from "./attribute-wire.js";
import { mapDynamoError } from "./error-mapper.js";
import type { ItemScope } from "./items.js";

const CHUNK = 25;
const MAX_ATTEMPTS = 8;

type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export async function batchDeleteItems(
  scope: ItemScope,
  keys: readonly Item[],
  sleep: Sleep = delay,
): Promise<{ deleted: number; failed: Item[] }> {
  let deleted = 0;
  const failed: Item[] = [];
  for (const chunk of chunked(dedupe(keys), CHUNK)) {
    throwIfAborted(scope.signal);
    const leftover = await deleteChunk(scope, chunk, sleep);
    failed.push(...leftover);
    deleted += chunk.length - leftover.length;
  }
  return { deleted, failed };
}

async function deleteChunk(scope: ItemScope, keys: readonly Item[], sleep: Sleep): Promise<Item[]> {
  let pending = [...keys];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && pending.length > 0; attempt += 1) {
    if (attempt > 0) {
      await sleep(jitter(attempt - 1), scope.signal);
      throwIfAborted(scope.signal);
    }
    const result = await send(
      scope,
      new BatchWriteItemCommand({
        RequestItems: {
          [scope.table]: pending.map((key) => ({ DeleteRequest: { Key: toSdkItem(key) } })),
        },
      }),
    );
    pending = unprocessed(result, scope.table);
  }
  return pending;
}

function dedupe(keys: readonly Item[]): Item[] {
  const seen = new Map<string, Item>();
  for (const key of keys) {
    seen.set(canonicalTypedJson(key), key);
  }
  return [...seen.values()];
}

function chunked(keys: readonly Item[], size: number): Item[][] {
  const pages: Item[][] = [];
  for (let index = 0; index < keys.length; index += size) {
    pages.push(keys.slice(index, index + size));
  }
  return pages;
}

function unprocessed(result: unknown, table: string): Item[] {
  const group = asRecord(asRecord(result)?.UnprocessedItems)?.[table];
  if (!Array.isArray(group)) {
    return [];
  }
  return group.flatMap((entry) => {
    const key = asRecord(asRecord(entry)?.DeleteRequest)?.Key;
    return isRecord(key) ? [fromSdkItem(key)] : [];
  });
}

function jitter(attempt: number): number {
  const cap = Math.min(2000, 50 * 2 ** attempt);
  return Math.floor(Math.random() * cap);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(aborted());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(aborted());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw aborted();
  }
}

function aborted(): Error {
  const error = new Error("Cancelled.");
  error.name = "AbortError";
  return error;
}

async function send(scope: ItemScope, command: { readonly input?: object }): Promise<unknown> {
  try {
    return await scope.client.send(
      command,
      scope.signal === undefined ? {} : { abortSignal: scope.signal },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw aborted();
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
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
