import { describe, expect, it } from "vitest";
import { parsePaletteQuery, rankPalette, type PaletteEntry } from "./palette-rank.js";

const absent = Number.POSITIVE_INFINITY;

function entry(
  id: string,
  label: string,
  kind: PaletteEntry["kind"],
  recentRank = absent,
): PaletteEntry {
  return { id, label, kind, keywords: "", recentRank };
}

describe("rankPalette", () => {
  it("treats a leading greater-than as actions only", () => {
    expect(parsePaletteQuery("  > theme")).toEqual({ actionsOnly: true, text: "theme" });
    const ranked = rankPalette(
      [entry("orders", "orders", "table"), entry("toggle-theme", "Toggle theme", "action")],
      ">theme",
    );
    expect(ranked.map((item) => item.id)).toEqual(["toggle-theme"]);
  });

  it("puts recent matches first", () => {
    const ranked = rankPalette(
      [
        entry("orders", "orders", "table"),
        entry("toggle-theme", "Toggle theme", "action", 0),
        entry("users", "users", "table", 1),
      ],
      "",
    );
    expect(ranked.slice(0, 2).map((item) => item.id)).toEqual(["toggle-theme", "users"]);
  });

  it("lets tables and connections outrank actions when the match ties", () => {
    const ranked = rankPalette(
      [
        entry("action", "Export", "action"),
        entry("connection", "Export", "connection"),
        entry("table", "Export", "table"),
      ],
      "Export",
    );
    expect(ranked.map((item) => item.kind)).toEqual(["connection", "table", "action"]);
  });

  it("fuzzy-matches and drops misses", () => {
    const ranked = rankPalette(
      [entry("orders", "orders", "table"), entry("users", "users", "table")],
      "ord",
    );
    expect(ranked.map((item) => item.id)).toEqual(["orders"]);
    expect(rankPalette([entry("orders", "orders", "table")], "zzz")).toEqual([]);
  });
});
