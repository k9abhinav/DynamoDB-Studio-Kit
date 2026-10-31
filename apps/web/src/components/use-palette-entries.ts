import { useMatch } from "react-router-dom";
import { useProfiles } from "../features/connection/use-profiles.js";
import { useTables } from "../features/tables/use-tables.js";
import { useLiveConnection } from "../features/workspace/use-live-connection.js";
import { readRecentActions, readRecentTables, type RecentTable } from "../lib/palette-recent.js";
import type { PaletteEntry } from "../lib/palette-rank.js";

const ACTIONS = [
  { id: "create-item", label: "Create item", needs: "item" },
  { id: "new-table", label: "New table", needs: "write" },
  { id: "export", label: "Export", needs: "table" },
  { id: "toggle-theme", label: "Toggle theme", needs: "always" },
  { id: "toggle-density", label: "Toggle density", needs: "always" },
  { id: "shortcuts", label: "Keyboard shortcuts", needs: "always" },
  { id: "about", label: "About", needs: "always" },
] as const;

export function usePaletteEntries(revision: number): {
  entries: PaletteEntry[];
  connId: string;
  table: string;
} {
  const nested = useMatch("/c/:connId/t/:table/:tab");
  const root = useMatch("/c/:connId");
  const connId = nested?.params.connId ?? root?.params.connId ?? "";
  const table = nested?.params.table ?? "";
  const tables = useTables(connId, "", connId.length > 0);
  const profiles = useProfiles();
  const connection = useLiveConnection(connId);
  const writable = connection.data?.summary.readOnly === false;
  const connected = connection.data !== undefined;
  const recentTables = revision < 0 ? [] : readRecentTables(localStorage);
  const recentActions = revision < 0 ? [] : readRecentActions(localStorage);

  return {
    connId,
    table,
    entries: buildEntries({
      names: tables.names,
      profiles: profiles.data ?? [],
      table,
      writable,
      connected,
      connId,
      recentTables,
      recentActions,
    }),
  };
}

function buildEntries(input: {
  names: readonly string[];
  profiles: readonly { id: string; name: string; endpoint: string }[];
  table: string;
  writable: boolean;
  connected: boolean;
  connId: string;
  recentTables: readonly RecentTable[];
  recentActions: readonly string[];
}): PaletteEntry[] {
  const tableRank = new Map(
    input.recentTables
      .filter((item) => item.connectionId === input.connId)
      .map((item, index) => [item.name, index]),
  );
  const actionRank = new Map(input.recentActions.map((id, index) => [id, index]));
  const entries: PaletteEntry[] = input.names.map((name) => ({
    id: `table:${name}`,
    label: name,
    kind: "table",
    keywords: "",
    recentRank: tableRank.get(name) ?? Number.POSITIVE_INFINITY,
  }));
  for (const profile of input.profiles) {
    entries.push({
      id: `connection:${profile.id}`,
      label: profile.name,
      kind: "connection",
      keywords: profile.endpoint,
      recentRank: Number.POSITIVE_INFINITY,
    });
  }
  for (const action of ACTIONS) {
    if (action.needs === "item" && (input.table.length === 0 || !input.writable)) {
      continue;
    }
    if (action.needs === "write" && (!input.connected || !input.writable)) {
      continue;
    }
    if (action.needs === "table" && input.table.length === 0) {
      continue;
    }
    entries.push({
      id: action.id,
      label: action.label,
      kind: "action",
      keywords: "",
      recentRank: actionRank.get(action.id) ?? Number.POSITIVE_INFINITY,
    });
  }
  return entries;
}
