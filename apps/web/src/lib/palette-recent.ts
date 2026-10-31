const TABLE_KEY = "ds-palette-tables";
const ACTION_KEY = "ds-palette-actions";
const MAX_RECENT = 8;

export interface RecentTable {
  connectionId: string;
  name: string;
}

export function readRecentTables(storage: Pick<Storage, "getItem">): RecentTable[] {
  return readTables(storage.getItem(TABLE_KEY));
}

export function rememberTable(
  storage: Pick<Storage, "getItem" | "setItem">,
  connectionId: string,
  name: string,
): void {
  const next = [
    { connectionId, name },
    ...readRecentTables(storage).filter(
      (table) => table.connectionId !== connectionId || table.name !== name,
    ),
  ].slice(0, MAX_RECENT);
  storage.setItem(TABLE_KEY, JSON.stringify({ v: 1, tables: next }));
}

export function readRecentActions(storage: Pick<Storage, "getItem">): string[] {
  return readActions(storage.getItem(ACTION_KEY));
}

export function rememberAction(
  storage: Pick<Storage, "getItem" | "setItem">,
  actionId: string,
): void {
  const next = [actionId, ...readRecentActions(storage).filter((id) => id !== actionId)].slice(
    0,
    MAX_RECENT,
  );
  storage.setItem(ACTION_KEY, JSON.stringify({ v: 1, actions: next }));
}

function readTables(raw: string | null): RecentTable[] {
  const value = readRecord(raw);
  if (value === null || value.v !== 1 || !Array.isArray(value.tables)) {
    return [];
  }
  const tables: RecentTable[] = [];
  for (const item of value.tables) {
    if (!isRecord(item)) {
      continue;
    }
    const { connectionId, name } = item;
    if (typeof connectionId !== "string" || typeof name !== "string") {
      continue;
    }
    if (connectionId.length === 0 || connectionId.length > 80 || name.length === 0) {
      continue;
    }
    tables.push({ connectionId, name });
  }
  return tables.slice(0, MAX_RECENT);
}

function readActions(raw: string | null): string[] {
  const value = readRecord(raw);
  if (value === null || value.v !== 1 || !Array.isArray(value.actions)) {
    return [];
  }
  return value.actions
    .filter(
      (item): item is string => typeof item === "string" && item.length > 0 && item.length < 40,
    )
    .slice(0, MAX_RECENT);
}

function readRecord(raw: string | null): Record<string, unknown> | null {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
