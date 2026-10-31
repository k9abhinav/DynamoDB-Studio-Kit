export type PaletteKind = "table" | "connection" | "action";

export interface PaletteEntry {
  id: string;
  label: string;
  kind: PaletteKind;
  keywords: string;
  recentRank: number;
}

const KIND_RANK: Record<PaletteKind, number> = {
  table: 0,
  connection: 0,
  action: 1,
};

export function parsePaletteQuery(query: string): { actionsOnly: boolean; text: string } {
  const leading = query.trimStart();
  if (leading.startsWith(">")) {
    return { actionsOnly: true, text: leading.slice(1).trim() };
  }
  return { actionsOnly: false, text: query.trim() };
}

export function rankPalette(entries: readonly PaletteEntry[], query: string): PaletteEntry[] {
  const parsed = parsePaletteQuery(query);
  const pool = parsed.actionsOnly ? entries.filter((entry) => entry.kind === "action") : entries;
  const scored: { entry: PaletteEntry; score: number }[] = [];
  for (const entry of pool) {
    const score = fuzzyScore(`${entry.label} ${entry.keywords}`, parsed.text);
    if (score === undefined) {
      continue;
    }
    scored.push({ entry, score });
  }
  scored.sort((left, right) => {
    if (left.entry.recentRank !== right.entry.recentRank) {
      return left.entry.recentRank - right.entry.recentRank;
    }
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    const kind = KIND_RANK[left.entry.kind] - KIND_RANK[right.entry.kind];
    if (kind !== 0) {
      return kind;
    }
    return left.entry.label.localeCompare(right.entry.label);
  });
  return scored.map((item) => item.entry);
}

function fuzzyScore(label: string, query: string): number | undefined {
  if (query.length === 0) {
    return 0;
  }
  const haystack = label.toLowerCase();
  const needle = query.toLowerCase();
  let from = 0;
  let score = 0;
  let streak = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, from);
    if (found < 0) {
      return undefined;
    }
    const gap = found - from;
    streak = gap === 0 ? streak + 1 : 1;
    score += 10 + streak * 5 - gap;
    const previous = found === 0 ? " " : haystack[found - 1];
    if (previous === " " || previous === "-" || previous === "_") {
      score += 8;
    }
    from = found + 1;
  }
  if (haystack.startsWith(needle)) {
    score += 50;
  }
  return score;
}
