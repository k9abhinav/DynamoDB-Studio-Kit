import { useEffect, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { parseTableTab } from "../../lib/tables.js";
import { useUiStore } from "../../stores/ui.js";

export function OpenTableTabs() {
  const navigate = useNavigate();
  const { connId = "", table, tab: rawTab } = useParams();
  const openTables = useUiStore((state) => state.openTables);
  const closeTable = useUiStore((state) => state.closeTable);
  const rememberTab = useUiStore((state) => state.rememberTab);
  const tab = parseTableTab(rawTab);

  useEffect(() => {
    if (table === undefined || tab === undefined) {
      return;
    }
    rememberTab(table, tab);
  }, [rememberTab, tab, table]);

  function focusTable(name: string) {
    const next = useUiStore.getState().lastTab[name] ?? "items";
    void navigate(`/c/${connId}/t/${encodeURIComponent(name)}/${next}`);
  }

  function close(name: string) {
    const neighbor = closeTable(name);
    if (name !== table) {
      return;
    }
    if (neighbor === undefined) {
      void navigate(`/c/${connId}`);
      return;
    }
    const next = useUiStore.getState().lastTab[neighbor] ?? "items";
    void navigate(`/c/${connId}/t/${encodeURIComponent(neighbor)}/${next}`);
  }

  function onAuxClick(event: MouseEvent, name: string) {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    close(name);
  }

  if (openTables.length === 0) {
    return null;
  }

  return (
    <div
      role="tablist"
      aria-label="Open tables"
      className="flex gap-1 overflow-auto border-b border-outline px-2"
    >
      {openTables.map((name) => {
        const current = name === table;
        return (
          <div key={name} className="flex items-center">
            <button
              type="button"
              role="tab"
              aria-selected={current}
              className={`h-10 px-3 text-sm ${current ? "text-primary" : "text-text-secondary"}`}
              onClick={() => {
                focusTable(name);
              }}
              onAuxClick={(event) => {
                onAuxClick(event, name);
              }}
            >
              {name}
            </button>
            <button
              type="button"
              aria-label={`Close ${name}`}
              className="h-10 px-2 text-sm text-text-secondary"
              onClick={() => {
                close(name);
              }}
              onAuxClick={(event) => {
                onAuxClick(event, name);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
