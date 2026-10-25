import type { InfiniteData } from "@tanstack/react-query";
import { canonicalTypedJson, type Item, type ScanResponse } from "@dynamo-studio/shared";

export type ScanPages = InfiniteData<ScanResponse, string | undefined>;

export function replaceScanItem(data: ScanPages, key: Item, item: Item): ScanPages {
  return mapPages(data, (page) => ({
    ...page,
    items: page.items.map((current) => (sameKey(current, key) ? item : current)),
  }));
}

export function removeScanItems(data: ScanPages, keys: readonly Item[]): ScanPages {
  return mapPages(data, (page) => {
    const items = page.items.filter((current) => !keys.some((key) => sameKey(current, key)));
    return { ...page, items, count: items.length };
  });
}

export function insertScanItem(data: ScanPages, item: Item): ScanPages {
  if (data.pages.length === 0) {
    return data;
  }
  return mapPages(data, (page, index) => {
    if (index !== 0) {
      return page;
    }
    const items = [item, ...page.items.filter((current) => !sameKey(current, item))];
    return { ...page, items, count: items.length };
  });
}

export function sameKey(item: Item, key: Item): boolean {
  const names = Object.keys(key);
  if (names.length === 0) {
    return false;
  }
  return names.every((name) => {
    const current = item[name];
    const expected = key[name];
    if (current === undefined || expected === undefined) {
      return false;
    }
    return canonicalTypedJson({ [name]: current }) === canonicalTypedJson({ [name]: expected });
  });
}

function mapPages(
  data: ScanPages,
  mapPage: (page: ScanResponse, index: number) => ScanResponse,
): ScanPages {
  return {
    ...data,
    pages: data.pages.map((page, index) => mapPage(page, index)),
  };
}
