import type { AttributeValue } from "@dynamo-studio/shared";

export const COLUMN_CAP = 200;
export const COLUMN_VIRTUAL_AFTER = 40;

export interface KeyColumn {
  name: string;
  keyType: "HASH" | "RANGE";
}

export interface ColumnPrefs {
  hidden: string[];
  widths: Record<string, number>;
  revealed: boolean;
}

export function orderedAttributes(
  items: readonly Record<string, AttributeValue>[],
  keys: readonly KeyColumn[],
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const pinned = [
    ...keys.filter((key) => key.keyType === "HASH"),
    ...keys.filter((key) => key.keyType === "RANGE"),
  ];
  for (const key of pinned) {
    if (!seen.has(key.name)) {
      seen.add(key.name);
      names.push(key.name);
    }
  }
  for (const item of items) {
    for (const name of Object.keys(item)) {
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }
  return names;
}

export function cappedAttributes(
  names: readonly string[],
  revealed: boolean,
): { visible: string[]; hiddenCount: number } {
  if (revealed || names.length <= COLUMN_CAP) {
    return { visible: [...names], hiddenCount: 0 };
  }
  return { visible: names.slice(0, COLUMN_CAP), hiddenCount: names.length - COLUMN_CAP };
}

export async function columnStorageKey(
  endpoint: string,
  region: string,
  table: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${endpoint}\n${region}\n${table}`),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `ds-columns:${hex}`;
}

export function readColumnPrefs(raw: string | null): ColumnPrefs {
  if (raw === null) {
    return { hidden: [], widths: {}, revealed: false };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { hidden: [], widths: {}, revealed: false };
    }
    const record = parsed as Record<string, unknown>;
    const hidden = Array.isArray(record.hidden)
      ? record.hidden.filter((name): name is string => typeof name === "string")
      : [];
    const widths: Record<string, number> = {};
    if (typeof record.widths === "object" && record.widths !== null) {
      for (const [name, width] of Object.entries(record.widths)) {
        if (typeof width === "number" && Number.isFinite(width)) {
          widths[name] = width;
        }
      }
    }
    return { hidden, widths, revealed: record.revealed === true };
  } catch {
    return { hidden: [], widths: {}, revealed: false };
  }
}

export function itemKey(item: Record<string, AttributeValue>, keyNames: readonly string[]): string {
  if (keyNames.length === 0) {
    return JSON.stringify(item);
  }
  const key: Record<string, AttributeValue> = {};
  for (const name of keyNames) {
    const value = item[name];
    if (value !== undefined) {
      key[name] = value;
    }
  }
  return JSON.stringify(key);
}
