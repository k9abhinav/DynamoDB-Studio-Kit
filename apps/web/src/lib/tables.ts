export interface MockTable {
  name: string;
  items: number;
}

export const MOCK_TABLES: readonly MockTable[] = [
  { name: "users", items: 1000 },
  { name: "orders", items: 10000 },
  { name: "sessions", items: 5 },
  { name: "edge-cases", items: 7 },
  { name: "a-very-long-table-name-that-should-truncate-in-the-sidebar", items: 1 },
];

export const TABLE_TABS = ["items", "partiql", "overview", "indexes"] as const;

export type TableTab = (typeof TABLE_TABS)[number];

export const TAB_LABELS: Record<TableTab, string> = {
  items: "Items",
  partiql: "PartiQL",
  overview: "Overview",
  indexes: "Indexes",
};

export function parseTableTab(value: string | undefined): TableTab | undefined {
  return TABLE_TABS.find((tab) => tab === value);
}

export function filterTables(tables: readonly MockTable[], query: string): MockTable[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return [...tables];
  }
  return tables.filter((table) => table.name.toLowerCase().includes(needle));
}

export function tableOptionId(name: string): string {
  return `table-option-${encodeURIComponent(name)}`;
}

export function splitTableMatch(
  name: string,
  query: string,
): { before: string; match: string; after: string } {
  const needle = query.trim();
  if (needle.length === 0) {
    return { before: name, match: "", after: "" };
  }
  const index = name.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) {
    return { before: name, match: "", after: "" };
  }
  return {
    before: name.slice(0, index),
    match: name.slice(index, index + needle.length),
    after: name.slice(index + needle.length),
  };
}

export function filterLabels(labels: readonly string[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return [...labels];
  }
  return labels.filter((label) => label.toLowerCase().includes(needle));
}
