import type { Item } from "@dynamo-studio/shared";
import { batchDeleteItems } from "./batch-delete.js";
import type { ImportCounts } from "./import-write.js";
import type { ItemScope } from "./items.js";

type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export async function* clearPages(input: {
  scope: ItemScope;
  load: (cursor: string | undefined) => Promise<{ items: Item[]; nextCursor?: string }>;
  sleep?: Sleep;
}): AsyncGenerator<ImportCounts> {
  const counts: ImportCounts = { processed: 0, written: 0, skipped: 0, failed: 0, duplicates: 0 };
  let cursor: string | undefined;
  try {
    for (;;) {
      if (input.scope.signal?.aborted === true) {
        yield { ...counts };
        return;
      }
      const page = await input.load(cursor);
      if (page.items.length > 0) {
        const deleted =
          input.sleep === undefined
            ? await batchDeleteItems(input.scope, page.items)
            : await batchDeleteItems(input.scope, page.items, input.sleep);
        counts.processed += page.items.length;
        counts.written += deleted.deleted;
        counts.failed += deleted.failed.length;
      }
      yield { ...counts };
      if (page.nextCursor === undefined) {
        return;
      }
      cursor = page.nextCursor;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      yield { ...counts };
      return;
    }
    throw error;
  }
}
