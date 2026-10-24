import { describe, expect, it } from "vitest";
import { TABLE_LIST_MAX_NAMES } from "@dynamo-studio/shared";
import { listTableNames, type TableNamePage } from "./list-tables.js";

function pagesOf(names: readonly string[], size = 100): (start?: string) => Promise<TableNamePage> {
  return (start) => {
    const from = start === undefined ? 0 : names.indexOf(start) + 1;
    const slice = names.slice(from, from + size);
    const last = slice.at(-1);
    const more = from + slice.length < names.length;
    return Promise.resolve({
      names: [...slice],
      ...(more && last !== undefined ? { nextStart: last } : {}),
    });
  };
}

describe("listTableNames", () => {
  it("returns one page and a cursor when exactly 100 names are followed by more", async () => {
    const names = Array.from(
      { length: 100 },
      (_unused, index) => `table-${String(index).padStart(3, "0")}`,
    );
    names.push("table-extra");
    const page = await listTableNames({ limit: 100, fetchPage: pagesOf(names) });
    expect(page.tables).toHaveLength(100);
    expect(page.nextCursor).toBeDefined();
    const cursor = page.nextCursor;
    if (cursor === undefined) {
      throw new Error("expected a cursor");
    }
    const rest = await listTableNames({
      limit: 100,
      cursor,
      fetchPage: pagesOf(names),
    });
    expect(rest.tables).toEqual(["table-extra"]);
    expect(rest.nextCursor).toBeUndefined();
  });

  it("filters case-insensitively and stops after 5,000 names", async () => {
    const names = Array.from({ length: 5_100 }, (_unused, index) =>
      index === 4_050 ? "Orders-archive" : `n-${String(index)}`,
    );
    const found = await listTableNames({
      limit: 10,
      search: "ORD",
      fetchPage: pagesOf(names),
    });
    expect(found.tables).toEqual(["Orders-archive"]);
    const capped = await listTableNames({
      limit: 10,
      search: "missing",
      fetchPage: pagesOf(names),
    });
    expect(capped.tables).toEqual([]);
    expect(capped.nextCursor).toBeUndefined();
    expect(TABLE_LIST_MAX_NAMES).toBe(5_000);
  });

  it("rejects a cursor from another shape", async () => {
    await expect(
      listTableNames({
        limit: 10,
        cursor: "not-a-cursor",
        fetchPage: pagesOf(["users"]),
      }),
    ).rejects.toThrow(/cursor/i);
  });
});
