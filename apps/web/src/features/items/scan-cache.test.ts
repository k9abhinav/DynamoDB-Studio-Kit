import type { ScanPages } from "./scan-cache.js";
import { insertScanItem, removeScanItems, replaceScanItem } from "./scan-cache.js";
import { describe, expect, it } from "vitest";

const page = {
  items: [
    { id: { S: "a" }, email: { S: "a@b.c" } },
    { id: { S: "b" }, email: { S: "b@b.c" } },
  ],
  count: 2,
  scannedCount: 2,
  hasMore: false,
};

function pages(): ScanPages {
  return { pages: [page], pageParams: [undefined] };
}

describe("scan cache patches", () => {
  it("replaces, inserts, and removes by key without touching the other row", () => {
    const replaced = replaceScanItem(
      pages(),
      { id: { S: "a" } },
      {
        id: { S: "a" },
        email: { S: "next@b.c" },
      },
    );
    expect(replaced.pages[0]?.items[0]).toEqual({ id: { S: "a" }, email: { S: "next@b.c" } });
    expect(replaced.pages[0]?.items[1]).toEqual(page.items[1]);

    const inserted = insertScanItem(pages(), { id: { S: "c" }, email: { S: "c@b.c" } });
    expect(inserted.pages[0]?.items).toHaveLength(3);
    expect(inserted.pages[0]?.count).toBe(3);

    const removed = removeScanItems(pages(), [{ id: { S: "b" } }]);
    expect(removed.pages[0]?.items).toEqual([page.items[0]]);
    expect(removed.pages[0]?.count).toBe(1);
  });
});
