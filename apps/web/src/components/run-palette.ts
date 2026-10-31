import { CreateConnectionResponse } from "@dynamo-studio/shared";
import type { NavigateFunction } from "react-router-dom";
import { api, ApiError } from "../lib/api.js";
import { errorCopy } from "../lib/error-copy.js";
import type { PaletteEntry } from "../lib/palette-rank.js";
import { rememberAction, rememberTable } from "../lib/palette-recent.js";
import { nextThemeMode, type ThemeMode } from "../lib/theme-mode.js";
import { useCommandStore } from "../stores/commands.js";
import { useOverlayStore } from "../stores/overlay.js";
import type { Density } from "../stores/ui.js";

export async function runPaletteEntry(
  entry: PaletteEntry,
  context: {
    connId: string;
    table: string;
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    density: Density;
    setDensity: (density: Density) => void;
    navigate: NavigateFunction;
    openOverlay: (overlay: "shortcuts" | "about") => void;
  },
): Promise<void> {
  if (entry.kind === "table") {
    const name = entry.id.slice("table:".length);
    if (context.connId.length === 0) {
      return;
    }
    rememberTable(localStorage, context.connId, name);
    void context.navigate(`/c/${context.connId}/t/${encodeURIComponent(name)}/items`);
    return;
  }
  if (entry.kind === "connection") {
    await switchConnection(entry.id.slice("connection:".length), context.navigate);
    return;
  }
  rememberAction(localStorage, entry.id);
  if (entry.id === "toggle-theme") {
    context.setMode(nextThemeMode(context.mode));
    return;
  }
  if (entry.id === "toggle-density") {
    context.setDensity(context.density === "compact" ? "comfortable" : "compact");
    return;
  }
  if (entry.id === "shortcuts") {
    context.openOverlay("shortcuts");
    return;
  }
  if (entry.id === "about") {
    context.openOverlay("about");
    return;
  }
  if (entry.id === "create-item" && context.table.length > 0) {
    void context.navigate(`/c/${context.connId}/t/${encodeURIComponent(context.table)}/items`);
    useCommandStore.getState().ask("create-item");
    return;
  }
  if (entry.id === "new-table") {
    useCommandStore.getState().ask("new-table");
    return;
  }
  if (entry.id === "export" && context.table.length > 0) {
    void context.navigate(`/c/${context.connId}/t/${encodeURIComponent(context.table)}/items`);
    useCommandStore.getState().ask("export");
  }
}

async function switchConnection(profileId: string, navigate: NavigateFunction): Promise<void> {
  try {
    const created = await api(`/api/v1/profiles/${encodeURIComponent(profileId)}/connect`, {
      method: "POST",
      schema: CreateConnectionResponse,
    });
    void navigate(`/c/${created.connectionId}`);
  } catch (error) {
    const message = error instanceof ApiError ? errorCopy(error) : "Couldn't switch connection.";
    useOverlayStore.getState().showSnackbar(message);
  }
}
