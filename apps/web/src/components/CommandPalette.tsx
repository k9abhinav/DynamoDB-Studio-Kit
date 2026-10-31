import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import { useColorScheme } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rankPalette } from "../lib/palette-rank.js";
import type { ThemeMode } from "../lib/theme-mode.js";
import { useOverlayStore } from "../stores/overlay.js";
import { useUiStore } from "../stores/ui.js";
import { runPaletteEntry } from "./run-palette.js";
import { usePaletteEntries } from "./use-palette-entries.js";

const RESULT_LIMIT = 50;

export function CommandPalette() {
  const open = useOverlayStore((state) => state.overlay === "palette");
  const close = useOverlayStore((state) => state.closeOverlay);
  const openOverlay = useOverlayStore((state) => state.openOverlay);
  const density = useUiStore((state) => state.density);
  const setDensity = useUiStore((state) => state.setDensity);
  const { mode, setMode } = useColorScheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [revision, setRevision] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }
  const { entries, connId, table } = usePaletteEntries(revision);
  const results = rankPalette(entries, query).slice(0, RESULT_LIMIT);
  const current = results[Math.min(active, Math.max(results.length - 1, 0))];

  useEffect(() => {
    if (open) {
      field.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (current === undefined) {
      return;
    }
    const node = document.getElementById(`palette-opt-${String(active)}`);
    if (node !== null && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [active, current]);

  const themeMode: ThemeMode =
    mode === "light" || mode === "dark" || mode === "system" ? mode : "system";

  return (
    <Dialog open={open} onClose={close} aria-labelledby="palette-title" fullWidth maxWidth="sm">
      <div className="p-4">
        <h2 id="palette-title" className="sr-only">
          Search
        </h2>
        <TextField
          inputRef={field}
          fullWidth
          label="Search"
          placeholder="Tables, connections, or > actions"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, results.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter" && current !== undefined) {
              event.preventDefault();
              choose(current.id);
            }
          }}
        />
        <div role="listbox" aria-label="Commands" className="mt-3 max-h-80 overflow-auto">
          {results.map((entry, index) => {
            const selected = entry.id === current?.id;
            return (
              <button
                key={entry.id}
                id={`palette-opt-${String(index)}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left ${
                  selected ? "bg-primary-container text-primary" : ""
                }`}
                onClick={() => {
                  choose(entry.id);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                <span
                  className={`text-xs ${selected ? "text-primary" : "text-text-secondary"}`}
                  aria-hidden="true"
                >
                  {kindLabel(entry.kind)}
                </span>
              </button>
            );
          })}
        </div>
        {results.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-text-secondary">No matches</p>
        ) : null}
      </div>
    </Dialog>
  );

  function choose(id: string): void {
    const entry = results.find((item) => item.id === id);
    if (entry === undefined) {
      return;
    }
    close();
    setQuery("");
    void runPaletteEntry(entry, {
      connId,
      table,
      mode: themeMode,
      setMode: (next) => {
        setMode(next);
      },
      density,
      setDensity,
      navigate,
      openOverlay: (overlay) => {
        openOverlay(overlay);
      },
    }).finally(() => {
      setRevision((value) => value + 1);
    });
  }
}

function kindLabel(kind: "table" | "connection" | "action"): string {
  if (kind === "table") {
    return "Table";
  }
  if (kind === "connection") {
    return "Connection";
  }
  return "Action";
}
