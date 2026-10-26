import { describe, expect, it } from "vitest";
import {
  clearPartiqlStorage,
  historyStorageKey,
  partiqlFingerprint,
  readHistory,
  readSaved,
  rememberStatement,
  saveQuery,
  savedStorageKey,
} from "./partiql-storage.js";

function memory(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("partiql storage", () => {
  it("keeps 100 statements, drops a consecutive duplicate, and clears both lists", async () => {
    const store = memory();
    const fingerprint = await partiqlFingerprint("http://127.0.0.1:8000", "us-east-1");
    expect(historyStorageKey(fingerprint)).toMatch(/^ds-partiql-history:[0-9a-f]{64}$/u);
    expect(historyStorageKey(fingerprint)).not.toContain("8000");
    for (let index = 0; index < 120; index += 1) {
      rememberStatement(store, fingerprint, `SELECT ${String(index)}`, "2026-10-26T00:00:00.000Z");
    }
    rememberStatement(store, fingerprint, "SELECT 119\r\n", "2026-10-26T00:00:01.000Z");
    const history = readHistory(store, fingerprint);
    expect(history.entries).toHaveLength(100);
    expect(history.entries[0]?.statement).toBe("SELECT 119");
    expect(history.v).toBe(1);
    saveQuery(store, fingerprint, {
      name: "Shipped",
      statement: 'SELECT * FROM "orders"',
      table: "orders",
    });
    expect(readSaved(store, fingerprint).queries).toHaveLength(1);
    const stored = store.getItem(savedStorageKey(fingerprint)) ?? "";
    expect(stored).not.toMatch(/secret|accessKey|sessionToken/u);
    expect(stored).not.toContain("8000");
    clearPartiqlStorage(store, fingerprint);
    expect(readHistory(store, fingerprint).entries).toEqual([]);
    expect(readSaved(store, fingerprint).queries).toEqual([]);
  });
});
