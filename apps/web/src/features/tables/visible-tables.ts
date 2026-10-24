import { filterLabels } from "../../lib/tables.js";

export function visibleTableNames(
  loaded: readonly string[],
  search: string,
  remote: readonly string[],
  hasMore: boolean,
): string[] {
  const local = filterLabels(loaded, search);
  if (!hasMore || search.trim().length === 0) {
    return local;
  }
  const needle = search.trim().toLowerCase();
  const seen = new Set(local);
  const extra = remote.filter((name) => {
    if (seen.has(name) || !name.toLowerCase().includes(needle)) {
      return false;
    }
    seen.add(name);
    return true;
  });
  return [...local, ...extra];
}
