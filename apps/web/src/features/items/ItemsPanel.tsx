import InboxOutlined from "@mui/icons-material/InboxOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { Filter, QueryRequest } from "@dynamo-studio/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { EmptyState } from "../../components/EmptyState.js";
import { ErrorState } from "../../components/ErrorState.js";
import { ApiError } from "../../lib/api.js";
import { queryKeys, scanKeys } from "../../lib/query-keys.js";
import { useUiStore } from "../../stores/ui.js";
import { useTable } from "../tables/use-table.js";
import { useLiveConnection } from "../workspace/use-live-connection.js";
import { ColumnChooser } from "./ColumnChooser.js";
import { DataGrid } from "./DataGrid.js";
import { FilterBar } from "./FilterBar.js";
import { QueryBuilder } from "./QueryBuilder.js";
import {
  cappedAttributes,
  columnStorageKey,
  itemKey,
  orderedAttributes,
  readColumnPrefs,
  type ColumnPrefs,
} from "./columns.js";
import { CopyMenu } from "./CopyMenu.js";
import { createTemplate } from "./editor-text.js";
import { SelectionDelete } from "./SelectionDelete.js";
import { buildQueryBody, emptyQueryDraft, queryTargets, type QueryDraft } from "./query-form.js";
import { useQueryItems } from "./use-query-items.js";
import { useScanItems, type ScanQueryInput } from "./use-scan-items.js";

const PAGE_SIZES = [25, 50, 100, 500] as const;

export function ItemsPanel({ connectionId, table }: { connectionId: string; table: string }) {
  const queryClient = useQueryClient();
  const connection = useLiveConnection(connectionId);
  const described = useTable(connectionId, table);
  const [mode, setMode] = useState<"scan" | "query">("scan");
  const [keepFilters, setKeepFilters] = useState(false);
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [joiner, setJoiner] = useState<"and" | "or">("and");
  const [consistentRead, setConsistentRead] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [draft, setDraft] = useState<QueryDraft>(emptyQueryDraft());
  const [run, setRun] = useState<Omit<QueryRequest, "cursor"> | null>(null);
  const [formError, setFormError] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [prefs, setPrefs] = useState<ColumnPrefs>({ hidden: [], widths: {}, revealed: false });
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [costDismissed, setCostDismissed] = useState(false);
  const nextScope = `${connectionId}\0${table}`;
  const [scope, setScope] = useState(nextScope);
  if (scope !== nextScope) {
    setScope(nextScope);
    setFilters([]);
    setJoiner("and");
    setSelected(new Set());
    setConsistentRead(false);
    setDraft(emptyQueryDraft());
    setTargetIndex(0);
    setRun(null);
    setKeepFilters(false);
    setFormError("");
  }
  const density = useUiStore((state) => state.density);
  const setPreview = useUiStore((state) => state.setItemPreview);
  const setDraftKind = useUiStore((state) => state.setDraftKind);
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const endpoint = connection.data?.summary.endpoint;
  const region = connection.data?.summary.region;
  const scanQuery: ScanQueryInput = {
    limit,
    filters,
    filterJoiner: joiner,
    consistentRead,
  };
  const targets = described.data === undefined ? [] : queryTargets(described.data);
  const scan = useScanItems(connectionId, table, scanQuery, mode === "scan");
  const queryItems = useQueryItems(connectionId, table, mode === "query" ? run : null);
  const reading = mode === "query" ? queryItems : scan;
  const waiting = mode === "query" && run === null;
  const items = reading.data?.pages.flatMap((page) => page.items) ?? [];
  const scanned = reading.data?.pages.reduce((sum, page) => sum + page.scannedCount, 0) ?? 0;
  const rcu =
    reading.data?.pages.reduce((sum, page) => sum + (page.consumedCapacity?.rcu ?? 0), 0) ?? 0;
  const keys = described.data?.keySchema ?? [];
  const names = orderedAttributes(items, keys);
  const capped = cappedAttributes(names, prefs.revealed);
  const visible = capped.visible.filter((name) => !prefs.hidden.includes(name));
  const loaded = items.length;
  const showCost =
    mode === "scan" && endpoint !== undefined && !isLoopback(endpoint) && !costDismissed;
  const queryPages = queryItems.data?.pages;
  const preview = queryPages === undefined ? undefined : queryPages[queryPages.length - 1]?.request;

  function changeMode(next: "scan" | "query"): void {
    if (next === mode) {
      return;
    }
    if (!keepFilters) {
      setFilters([]);
      setJoiner("and");
    }
    setSelected(new Set());
    setFormError("");
    setMode(next);
  }

  function runQuery(): void {
    const target = targets[targetIndex];
    if (target === undefined) {
      return;
    }
    const built = buildQueryBody({
      target,
      draft,
      limit,
      filters,
      filterJoiner: joiner,
    });
    if (!built.ok) {
      setFormError(built.message);
      return;
    }
    setFormError("");
    setSelected(new Set());
    setRun({ ...built.body, limit });
  }

  useEffect(() => {
    if (endpoint === undefined || region === undefined) {
      return;
    }
    let cancelled = false;
    void columnStorageKey(endpoint, region, table).then((key) => {
      if (cancelled) {
        return;
      }
      setStorageKey(key);
      setPrefs(readColumnPrefs(localStorage.getItem(key)));
      setCostDismissed(sessionStorage.getItem(costKey(table)) === "1");
    });
    return () => {
      cancelled = true;
    };
  }, [endpoint, region, table]);

  function writePrefs(next: ColumnPrefs): void {
    setPrefs(next);
    if (storageKey !== null) {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
  }

  function startCreate(): void {
    if (described.data === undefined) {
      return;
    }
    setPreview(
      createTemplate(described.data.keySchema.map((key) => ({ name: key.name, type: key.type }))),
    );
    setDraftKind("create");
    setDrawerOpen(true);
  }

  function refresh(): void {
    if (mode === "query") {
      void queryClient.resetQueries({ queryKey: queryKeys.table(connectionId, table, run) });
      return;
    }
    void queryClient.resetQueries({
      queryKey: scanKeys.table(connectionId, table, scanQuery),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-outline px-3 py-2">
        <Toolbar mode={mode} onMode={changeMode} />
        <FormControlLabel
          control={
            <Checkbox
              checked={keepFilters}
              onChange={(event) => {
                setKeepFilters(event.target.checked);
              }}
            />
          }
          label="Keep filters"
        />
        {loaded > 0 ? (
          <Button
            variant="contained"
            disabled={described.data === undefined || connection.data?.summary.readOnly === true}
            title={
              connection.data?.summary.readOnly === true
                ? "This connection is read-only"
                : undefined
            }
            onClick={startCreate}
          >
            Create item
          </Button>
        ) : null}
        <TextField
          select
          size="small"
          label="Page size"
          value={String(limit)}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (next === 25 || next === 50 || next === 100 || next === 500) {
              setLimit(next);
              setSelected(new Set());
            }
          }}
        >
          {PAGE_SIZES.map((size) => (
            <MenuItem key={size} value={String(size)}>
              {size}
            </MenuItem>
          ))}
        </TextField>
        {mode === "scan" ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={consistentRead}
                onChange={(event) => {
                  setConsistentRead(event.target.checked);
                }}
              />
            }
            label="Consistent read"
          />
        ) : null}
        <Button
          onClick={() => {
            refresh();
          }}
        >
          Refresh
        </Button>
        <ColumnChooser
          names={capped.visible}
          hidden={prefs.hidden}
          capped={capped.hiddenCount}
          onToggle={(name, shown) => {
            const hidden = shown
              ? prefs.hidden.filter((item) => item !== name)
              : [...prefs.hidden, name];
            writePrefs({ ...prefs, hidden });
          }}
          onReset={() => {
            if (storageKey !== null) {
              localStorage.removeItem(storageKey);
            }
            writePrefs({ hidden: [], widths: {}, revealed: false });
          }}
          onReveal={() => {
            writePrefs({ ...prefs, revealed: true });
          }}
        />
        {capped.hiddenCount > 0 ? (
          <Button
            onClick={() => {
              writePrefs({ ...prefs, revealed: true });
            }}
          >
            Show more columns
          </Button>
        ) : null}
      </div>
      {mode === "query" && described.isError ? (
        <div className="p-4">
          <ErrorState
            message={
              described.error instanceof ApiError
                ? described.error.message
                : "Couldn't load the table."
            }
            details={
              described.error instanceof Error
                ? described.error.message
                : "Couldn't load the table."
            }
            onRetry={() => {
              void described.refetch();
            }}
          />
        </div>
      ) : null}
      {mode === "query" && described.data !== undefined ? (
        <div>
          <QueryBuilder
            targets={targets}
            targetIndex={targetIndex}
            onTarget={(index) => {
              const next = targets[index];
              setTargetIndex(index);
              setRun(null);
              setDraft({
                ...emptyQueryDraft(),
                scanForward: draft.scanForward,
                projection: draft.projection,
                consistentRead: next?.kind === "gsi" ? false : draft.consistentRead,
              });
            }}
            draft={draft}
            onDraft={setDraft}
            onRun={runQuery}
            preview={preview}
            region={region ?? ""}
            endpoint={endpoint ?? ""}
          />
          {formError.length > 0 ? (
            <p className="px-3 pb-2 text-sm text-error">{formError}</p>
          ) : null}
        </div>
      ) : null}
      <div className="border-b border-outline px-3 py-2">
        <FilterBar
          columns={names}
          sample={items[0]}
          filters={filters}
          joiner={joiner}
          onChange={(next, nextJoiner) => {
            setFilters(next);
            setJoiner(nextJoiner);
            setSelected(new Set());
          }}
        />
      </div>
      {reading.isFetching ? <LinearProgress aria-label="Refreshing items" /> : null}
      {showCost ? (
        <Alert
          severity="info"
          variant="outlined"
          className="m-3"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                sessionStorage.setItem(costKey(table), "1");
                setCostDismissed(true);
              }}
            >
              Dismiss scan cost hint
            </Button>
          }
        >
          Scanning this table reads items and consumes read capacity.
        </Alert>
      ) : null}
      <p className="px-3 py-1 text-xs text-text-secondary">
        {`Showing ${String(loaded)} · Scanned ${String(scanned)} · ${formatRcu(rcu)} RCU`}
      </p>
      {filters.length > 0 && scanned > loaded ? (
        <p className="px-3 pb-1 text-xs text-text-secondary">
          Filters run after reading items, so Scan still reads the whole page.
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {`${String(loaded)} items loaded`}
      </p>
      {selected.size > 0 ? (
        <div className="flex items-center gap-2 border-b border-outline px-3 py-2">
          <span>{`${String(selected.size)} selected`}</span>
          <SelectionDelete
            connectionId={connectionId}
            enabled={described.data !== undefined}
            readOnly={connection.data?.summary.readOnly === true}
            env={connection.data?.summary.env ?? "local"}
            items={items}
            keyNames={keys.map((key) => key.name)}
            keys={keys.map((key) => ({ name: key.name, type: key.type }))}
            selected={selected}
            table={table}
            onDone={() => {
              setSelected(new Set());
            }}
          />
          <CopyMenu
            disabled={
              items.find((item) =>
                selected.has(
                  itemKey(
                    item,
                    keys.map((key) => key.name),
                  ),
                ),
              ) === undefined
            }
            endpoint={connection.data?.summary.endpoint ?? ""}
            item={
              items.find((item) =>
                selected.has(
                  itemKey(
                    item,
                    keys.map((key) => key.name),
                  ),
                ),
              ) ?? {
                id: { S: "" },
              }
            }
            region={connection.data?.summary.region ?? ""}
            table={table}
          />
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {reading.isError ? (
          <div className="p-4">
            <ErrorState
              message={
                reading.error instanceof ApiError
                  ? reading.error.message
                  : mode === "query"
                    ? "The query failed."
                    : "The scan failed."
              }
              details={reading.error instanceof Error ? reading.error.message : "The scan failed."}
              onRetry={() => {
                void reading.refetch();
              }}
            />
          </div>
        ) : waiting ? (
          described.data === undefined ? null : (
            <p className="px-4 py-6 text-sm">Run a query to load items.</p>
          )
        ) : reading.isPending ? (
          <p className="px-4 py-6 text-sm" role="status" aria-label="Loading items">
            Loading items
          </p>
        ) : loaded === 0 && reading.hasNextPage ? (
          <div className="px-4 py-6">
            <Button
              onClick={() => {
                void reading.fetchNextPage();
              }}
            >
              Keep searching
            </Button>
          </div>
        ) : loaded === 0 && filters.length > 0 ? (
          <EmptyState
            icon={<InboxOutlined className="text-[48px]" />}
            title="No items match these filters."
            help="Clear the filters to see every loaded item."
            action={
              <Button
                onClick={() => {
                  setFilters([]);
                  setJoiner("and");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : loaded === 0 ? (
          <EmptyState
            icon={<InboxOutlined className="text-[48px]" />}
            title="This table is empty."
            help="Add your first item when editing arrives."
            action={
              <Button
                variant="contained"
                disabled={
                  described.data === undefined || connection.data?.summary.readOnly === true
                }
                onClick={startCreate}
              >
                Create item
              </Button>
            }
          />
        ) : (
          <DataGrid
            items={items}
            columns={visible}
            keys={keys}
            widths={prefs.widths}
            onWidth={(name, width) => {
              writePrefs({ ...prefs, widths: { ...prefs.widths, [name]: width } });
            }}
            rowPx={density === "compact" ? 32 : 48}
            selected={selected}
            onSelected={setSelected}
            onOpen={(item) => {
              setPreview(item);
              setDraftKind("view");
              setDrawerOpen(true);
            }}
            onNearEnd={() => {
              if (reading.hasNextPage && !reading.isFetchingNextPage) {
                void reading.fetchNextPage();
              }
            }}
            scrollKey={`${connectionId}:${table}`}
          />
        )}
      </div>
      {loaded > 0 ? (
        <div className="flex items-center gap-3 border-t border-outline px-3 py-2">
          {reading.hasNextPage ? (
            <Button
              onClick={() => {
                void reading.fetchNextPage();
              }}
            >
              Load more
            </Button>
          ) : (
            <span className="text-sm text-text-secondary">End of results</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Toolbar({
  mode,
  onMode,
}: {
  mode: "scan" | "query";
  onMode: (mode: "scan" | "query") => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
      aria-label="Read mode"
      onChange={(_event, next: string | null) => {
        if (next === "scan" || next === "query") {
          onMode(next);
        }
      }}
    >
      <ToggleButton value="scan">Scan</ToggleButton>
      <ToggleButton value="query">Query</ToggleButton>
    </ToggleButtonGroup>
  );
}

function isLoopback(endpoint: string): boolean {
  try {
    const host = new URL(endpoint).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

function costKey(table: string): string {
  return `ds-scan-cost:${table}`;
}

function formatRcu(rcu: number): string {
  return String(Math.round(rcu * 100) / 100);
}
