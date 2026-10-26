import { z } from "zod";

const HistoryEntry = z.strictObject({
  statement: z.string().min(1),
  savedAt: z.string().min(1),
});

const HistoryFile = z.strictObject({
  v: z.literal(1),
  entries: z.array(HistoryEntry).max(100),
});

const SavedQuery = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  statement: z.string().min(1),
  table: z.string().min(1).optional(),
});

const SavedFile = z.strictObject({
  v: z.literal(1),
  queries: z.array(SavedQuery).max(100),
});

export type HistoryEntry = z.infer<typeof HistoryEntry>;
export type SavedQuery = z.infer<typeof SavedQuery>;
export type HistoryFile = z.infer<typeof HistoryFile>;
export type SavedFile = z.infer<typeof SavedFile>;

export const EMPTY_HISTORY: HistoryFile = { v: 1, entries: [] };
export const EMPTY_SAVED: SavedFile = { v: 1, queries: [] };

export async function partiqlFingerprint(endpoint: string, region: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${endpoint}\0${region}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function historyStorageKey(fingerprint: string): string {
  return `ds-partiql-history:${fingerprint}`;
}

export function savedStorageKey(fingerprint: string): string {
  return `ds-partiql-saved:${fingerprint}`;
}

export function normalizeStatement(statement: string): string {
  return statement.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function readJson<T>(schema: { parse: (value: unknown) => T }, raw: string | null, empty: T): T {
  if (raw === null) {
    return empty;
  }
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    return empty;
  }
}

export function readHistory(storage: Storage, fingerprint: string): HistoryFile {
  return readJson(HistoryFile, storage.getItem(historyStorageKey(fingerprint)), EMPTY_HISTORY);
}

export function readSaved(storage: Storage, fingerprint: string): SavedFile {
  return readJson(SavedFile, storage.getItem(savedStorageKey(fingerprint)), EMPTY_SAVED);
}

export function rememberStatement(
  storage: Storage,
  fingerprint: string,
  statement: string,
  savedAt: string,
): HistoryFile {
  const text = normalizeStatement(statement).trim();
  const current = readHistory(storage, fingerprint);
  if (text.length === 0 || current.entries[0]?.statement === text) {
    return current;
  }
  const next: HistoryFile = {
    v: 1,
    entries: [{ statement: text, savedAt }, ...current.entries].slice(0, 100),
  };
  storage.setItem(historyStorageKey(fingerprint), JSON.stringify(next));
  return next;
}

export function saveQuery(
  storage: Storage,
  fingerprint: string,
  query: { name: string; statement: string; table?: string },
): SavedFile {
  const current = readSaved(storage, fingerprint);
  const next: SavedFile = {
    v: 1,
    queries: [
      {
        id: crypto.randomUUID(),
        name: query.name.trim(),
        statement: normalizeStatement(query.statement),
        ...(query.table === undefined ? {} : { table: query.table }),
      },
      ...current.queries,
    ].slice(0, 100),
  };
  storage.setItem(savedStorageKey(fingerprint), JSON.stringify(next));
  return next;
}

export function clearPartiqlStorage(storage: Storage, fingerprint: string): void {
  storage.removeItem(historyStorageKey(fingerprint));
  storage.removeItem(savedStorageKey(fingerprint));
}
