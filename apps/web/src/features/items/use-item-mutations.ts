import type { Item, ItemWriteResponse } from "@dynamo-studio/shared";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../lib/api.js";
import { scanKeys } from "../../lib/query-keys.js";
import { deleteStoredItem, putStoredItem, updateStoredItem } from "./item-api.js";
import { insertScanItem, removeScanItems, replaceScanItem, type ScanPages } from "./scan-cache.js";

export interface EditConflict {
  readonly key: Item;
  readonly attempted: Item;
  readonly expectedHash: string;
}

type Snapshot = Array<[QueryKey, ScanPages | undefined]>;

export function useItemMutations(connectionId: string, table: string) {
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<EditConflict | null>(null);
  const prefix = ["scan", connectionId, table] as const;

  function snapshots(): Snapshot {
    return queryClient.getQueriesData<ScanPages>({ queryKey: prefix });
  }

  function restore(previous: Snapshot): void {
    for (const [key, data] of previous) {
      queryClient.setQueryData(key, data);
    }
  }

  function patch(change: (data: ScanPages) => ScanPages): void {
    for (const [key, data] of snapshots()) {
      if (data !== undefined) {
        queryClient.setQueryData(key, change(data));
      }
    }
  }

  const update = useMutation({
    mutationFn: (input: { key: Item; item: Item; expectedHash?: string }) =>
      updateStoredItem(connectionId, table, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: scanKeys.connection(connectionId) });
      const previous = snapshots();
      patch((data) => replaceScanItem(data, input.key, input.item));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context !== undefined) {
        restore(context.previous);
      }
    },
    onSuccess: (result: ItemWriteResponse, input) => {
      patch((data) => replaceScanItem(data, input.key, result.item));
    },
  });

  const create = useMutation({
    mutationFn: (input: { key: Item; item: Item }) =>
      putStoredItem(connectionId, table, { item: input.item, ifNotExists: true }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: scanKeys.connection(connectionId) });
      const previous = snapshots();
      patch((data) => insertScanItem(data, input.item));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context !== undefined) {
        restore(context.previous);
      }
    },
    onSuccess: (result, input) => {
      patch((data) => replaceScanItem(data, input.key, result.item));
    },
  });

  const remove = useMutation({
    mutationFn: (key: Item) => deleteStoredItem(connectionId, table, key),
    onMutate: async (key) => {
      await queryClient.cancelQueries({ queryKey: scanKeys.connection(connectionId) });
      const previous = snapshots();
      patch((data) => removeScanItems(data, [key]));
      return { previous };
    },
    onError: (_error, _key, context) => {
      if (context !== undefined) {
        restore(context.previous);
      }
    },
  });

  async function undoEdit(input: {
    key: Item;
    previous: Item;
    savedHash: string;
  }): Promise<ItemWriteResponse | undefined> {
    try {
      return await update.mutateAsync({
        key: input.key,
        item: input.previous,
        expectedHash: input.savedHash,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "CONDITION_FAILED") {
        setConflict({
          key: input.key,
          attempted: input.previous,
          expectedHash: input.savedHash,
        });
        return;
      }
      throw error;
    }
  }

  return {
    update,
    create,
    remove,
    undoEdit,
    conflict,
    clearConflict() {
      setConflict(null);
    },
  };
}
