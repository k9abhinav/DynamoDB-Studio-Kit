import {
  BatchDeleteResponse,
  DeleteItemResponse,
  GetItemResponse,
  ItemWriteResponse,
  type Item,
} from "@dynamo-studio/shared";
import { ApiError, api } from "../../lib/api.js";

const CHUNK = 25;

export function itemPath(connectionId: string, table: string, action: string): string {
  return `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(table)}/items${action}`;
}

export function getStoredItem(
  connectionId: string,
  table: string,
  key: Item,
  signal?: AbortSignal,
): Promise<Item | null> {
  return api(itemPath(connectionId, table, "/get"), {
    method: "POST",
    body: { key },
    schema: GetItemResponse,
    ...(signal === undefined ? {} : { signal }),
  }).then((body) => body.item);
}

export function putStoredItem(
  connectionId: string,
  table: string,
  body: { item: Item; ifNotExists?: boolean; expectedHash?: string },
  signal?: AbortSignal,
): Promise<ItemWriteResponse> {
  return api(itemPath(connectionId, table, ""), {
    method: "PUT",
    body,
    schema: ItemWriteResponse,
    ...(signal === undefined ? {} : { signal }),
  });
}

export function updateStoredItem(
  connectionId: string,
  table: string,
  body: { key: Item; item: Item; expectedHash?: string },
  signal?: AbortSignal,
): Promise<ItemWriteResponse> {
  return api(itemPath(connectionId, table, "/update"), {
    method: "POST",
    body,
    schema: ItemWriteResponse,
    ...(signal === undefined ? {} : { signal }),
  });
}

export function deleteStoredItem(
  connectionId: string,
  table: string,
  key: Item,
  signal?: AbortSignal,
): Promise<DeleteItemResponse> {
  return api(itemPath(connectionId, table, "/delete"), {
    method: "POST",
    body: { key },
    schema: DeleteItemResponse,
    ...(signal === undefined ? {} : { signal }),
  });
}

export async function batchDeleteChunked(
  connectionId: string,
  table: string,
  keys: readonly Item[],
  options: {
    signal?: AbortSignal;
    onChunk?: (progress: { done: number; deleted: number; failed: Item[] }) => void;
  } = {},
): Promise<{ deleted: number; failed: Item[] }> {
  let deleted = 0;
  const failed: Item[] = [];
  for (let index = 0; index < keys.length; index += CHUNK) {
    if (options.signal?.aborted === true) {
      break;
    }
    const slice = keys.slice(index, index + CHUNK);
    try {
      const result = await api(itemPath(connectionId, table, "/batch-delete"), {
        method: "POST",
        body: { keys: slice },
        schema: BatchDeleteResponse,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      });
      deleted += result.deleted;
      failed.push(...result.failed);
      options.onChunk?.({
        done: Math.min(index + CHUNK, keys.length),
        deleted,
        failed: [...failed],
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        break;
      }
      throw error;
    }
  }
  return { deleted, failed };
}
