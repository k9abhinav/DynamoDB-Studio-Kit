import { describe, expect, it } from "vitest";
import {
  rememberAction,
  rememberTable,
  readRecentActions,
  readRecentTables,
} from "./palette-recent.js";

function memory(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("palette recents", () => {
  it("stores table names and ids only, newest first, capped at 8", () => {
    const storage = memory();
    for (let index = 0; index < 9; index += 1) {
      rememberTable(storage, "c1", `table-${String(index)}`);
    }
    rememberTable(storage, "c1", "table-7");
    const tables = readRecentTables(storage);
    expect(tables[0]).toEqual({ connectionId: "c1", name: "table-7" });
    expect(tables).toHaveLength(8);
    expect(tables.some((table) => table.name === "table-0")).toBe(false);
    const raw = storage.getItem("ds-palette-tables") ?? "";
    expect(raw).not.toContain("secret");
    expect(JSON.parse(raw)).toEqual({
      v: 1,
      tables: tables,
    });
  });

  it("ignores corrupt storage and remembers action ids", () => {
    const storage = memory();
    storage.setItem("ds-palette-tables", "{");
    storage.setItem("ds-palette-actions", JSON.stringify({ v: 1, actions: ["export", 4, ""] }));
    expect(readRecentTables(storage)).toEqual([]);
    expect(readRecentActions(storage)).toEqual(["export"]);
    rememberAction(storage, "export");
    rememberAction(storage, "toggle-theme");
    expect(readRecentActions(storage)).toEqual(["toggle-theme", "export"]);
  });
});
