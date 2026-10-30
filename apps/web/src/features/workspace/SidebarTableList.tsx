import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import TableChartOutlined from "@mui/icons-material/TableChartOutlined";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CreateTableWizard } from "../tables/CreateTableWizard.js";
import { useNavigate, useParams } from "react-router-dom";
import { useTables } from "../tables/use-tables.js";
import { SIDEBAR_BREAKPOINT } from "../../lib/layout.js";
import { filterLabels, splitTableMatch, tableOptionId, type MockTable } from "../../lib/tables.js";
import { useUiStore } from "../../stores/ui.js";

const ROW_HEIGHT = 40;
const VIRTUALIZE_AFTER = 200;

export function SidebarTableList({
  tables,
  readOnly = false,
}: {
  tables?: readonly MockTable[];
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set());
  const navigate = useNavigate();
  const narrow = useMediaQuery(`(max-width: ${String(SIDEBAR_BREAKPOINT - 1)}px)`);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const { connId = "", table: selected } = useParams();
  const fixture = tables !== undefined;
  const live = useTables(connId, query, !fixture);
  const names = fixture
    ? filterLabels(
        tables.map((table) => table.name),
        query,
      )
    : live.visible;
  const count = fixture ? tables.length : live.names.length;
  const rail = narrow || collapsed;
  const virtual = names.length > VIRTUALIZE_AFTER;
  const current = names.length === 0 ? 0 : Math.min(active, names.length - 1);
  const activeName = names[current];

  // The virtualizer returns fresh functions; row markup is rendered inline.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual's supported API
  const virtualizer = useVirtualizer({
    count: names.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    ...(import.meta.env.MODE === "test"
      ? {
          observeElementRect: (
            _instance: unknown,
            cb: (rect: { width: number; height: number }) => void,
          ) => {
            cb({ width: 280, height: 400 });
            return () => undefined;
          },
        }
      : {}),
  });

  const signature = names.join("\n");
  useEffect(() => {
    const next = new Set(signature.length === 0 ? [] : signature.split("\n"));
    const previous = seen.current;
    seen.current = next;
    if (previous === null) {
      return;
    }
    const fresh = [...next].filter((name) => !previous.has(name));
    if (fresh.length === 0) {
      return;
    }
    setArrived(new Set(fresh));
    const timer = window.setTimeout(() => {
      setArrived(new Set());
    }, 400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [signature]);

  function openTable(name: string) {
    const tab = useUiStore.getState().lastTab[name] ?? "items";
    void navigate(`/c/${connId}/t/${encodeURIComponent(name)}/${tab}`);
  }

  function move(delta: number) {
    const next = Math.max(0, Math.min(names.length - 1, current + delta));
    setActive(next);
    if (virtual) {
      virtualizer.scrollToIndex(next);
    }
  }

  function onKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape") {
      setQuery("");
      setActive(0);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "Enter" && names[0] !== undefined) {
      event.preventDefault();
      const fromList = event.currentTarget.getAttribute("role") === "listbox";
      const target = fromList ? (activeName ?? names[0]) : names[0];
      openTable(target);
    }
  }

  const rows = virtual
    ? virtualizer.getVirtualItems().map((item) => ({
        index: item.index,
        start: item.start,
        key: item.key,
      }))
    : names.map((_, index) => ({ index, start: 0, key: index }));

  return (
    <nav
      aria-label="Tables"
      className={`flex h-full min-h-0 flex-col overflow-hidden border-r border-outline bg-surface ${rail ? "w-[72px]" : "w-[280px]"}`}
    >
      <div className="flex items-center justify-between px-2 py-2">
        {rail ? null : (
          <span className="flex items-center gap-2 px-2 text-sm font-medium">
            Tables ({count})
            {live.hasMore && !fixture ? (
              <Skeleton
                variant="circular"
                width={12}
                height={12}
                aria-label="Loading more tables"
              />
            ) : null}
          </span>
        )}
        <div className="flex">
          {rail || fixture ? null : (
            <IconButton
              aria-label="Refresh tables"
              onClick={() => {
                live.refresh();
              }}
            >
              <RefreshOutlined
                className={live.isRefreshing ? "animate-spin" : undefined}
                fontSize="small"
              />
            </IconButton>
          )}
          {narrow ? null : (
            <IconButton
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={toggleSidebar}
            >
              <TableChartOutlined fontSize="small" />
            </IconButton>
          )}
        </div>
      </div>
      {rail ? null : (
        <div className="px-3 pb-2">
          <TextField
            size="small"
            fullWidth
            type="search"
            label="Filter tables"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
      {rail || live.isLoading || names.length > 0 || live.error !== null ? null : (
        <p className="px-4 text-sm text-text-secondary">
          {query.trim().length === 0 ? "No tables yet." : "No matching tables."}
        </p>
      )}
      {live.error === null || fixture ? null : (
        <p className="px-4 text-sm text-text-secondary">Could not load tables.</p>
      )}
      <div ref={parentRef} className="h-0 min-h-0 flex-1 overflow-auto">
        <div
          role="listbox"
          aria-label="Table names"
          aria-busy={live.hasMore && !fixture}
          aria-activedescendant={activeName === undefined ? undefined : tableOptionId(activeName)}
          tabIndex={0}
          className="relative m-0 p-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          style={virtual ? { height: virtualizer.getTotalSize() } : undefined}
          onKeyDown={onKeyDown}
        >
          {rows.map((row) => {
            const name = names[row.index];
            if (name === undefined) {
              return null;
            }
            const parts = splitTableMatch(name, query);
            const currentTable = name === selected;
            return (
              <div
                key={name}
                id={tableOptionId(name)}
                role="option"
                tabIndex={-1}
                aria-selected={row.index === current}
                onKeyDown={onKeyDown}
                data-arrived={arrived.has(name) ? "true" : undefined}
                className={`relative flex h-10 items-center gap-2 px-3 ${
                  arrived.has(name) ? "motion-safe:animate-pulse" : ""
                } ${
                  currentTable
                    ? "bg-primary-container text-primary"
                    : "text-text hover:bg-surface-variant"
                }`}
                style={
                  virtual
                    ? {
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${String(row.start)}px)`,
                      }
                    : undefined
                }
                onClick={() => {
                  setActive(row.index);
                  openTable(name);
                }}
              >
                {currentTable ? (
                  <span className="absolute top-0 left-0 h-full w-[3px] bg-primary" />
                ) : null}
                <TableChartOutlined fontSize="small" />
                {rail ? null : (
                  <span className="truncate">
                    {parts.before}
                    {parts.match.length > 0 ? (
                      <mark className="bg-primary-container text-inherit">{parts.match}</mark>
                    ) : null}
                    {parts.after}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {rail ? null : (
        <>
          <Tooltip title={readOnly ? "This connection is read-only" : ""}>
            <span className="mx-3 mt-3 mb-3 block">
              <button
                type="button"
                disabled={readOnly}
                className="h-10 w-full rounded-full text-sm text-primary disabled:text-text-disabled"
                onClick={() => {
                  setCreating(true);
                }}
              >
                Create table
              </button>
            </span>
          </Tooltip>
          <CreateTableWizard
            open={creating}
            connectionId={connId}
            onClose={() => {
              setCreating(false);
            }}
          />
        </>
      )}
    </nav>
  );
}
