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
import type { Filter } from "@dynamo-studio/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { EmptyState } from "../../components/EmptyState.js";
import { ErrorState } from "../../components/ErrorState.js";
import { ApiError } from "../../lib/api.js";
import { scanKeys } from "../../lib/query-keys.js";
import { useUiStore } from "../../stores/ui.js";
import { useTable } from "../tables/use-table.js";
import { useLiveConnection } from "../workspace/use-live-connection.js";
import { ColumnChooser } from "./ColumnChooser.js";
import { DataGrid } from "./DataGrid.js";
import { FilterBar } from "./FilterBar.js";
import {
  cappedAttributes,
  columnStorageKey,
  orderedAttributes,
  readColumnPrefs,
  type ColumnPrefs,
} from "./columns.js";
import { useScanItems, type ScanQueryInput } from "./use-scan-items.js";

const PAGE_SIZES = [25, 50, 100, 500] as const;

export function ItemsPanel({ connectionId, table }: { connectionId: string; table: string }) {
  const queryClient = useQueryClient();
  const connection = useLiveConnection(connectionId);
  const described = useTable(connectionId, table);
  const [mode, setMode] = useState<"scan" | "query">("scan");
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [joiner, setJoiner] = useState<"and" | "or">("and");
  const [consistentRead, setConsistentRead] = useState(false);
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
  }
  const density = useUiStore((state) => state.density);
  const setPreview = useUiStore((state) => state.setItemPreview);
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const endpoint = connection.data?.summary.endpoint;
  const region = connection.data?.summary.region;
  const query: ScanQueryInput = {
    limit,
    filters,
    filterJoiner: joiner,
    consistentRead,
  };
  const scan = useScanItems(connectionId, table, query, mode === "scan");
  const items = scan.data?.pages.flatMap((page) => page.items) ?? [];
  const scanned = scan.data?.pages.reduce((sum, page) => sum + page.scannedCount, 0) ?? 0;
  const rcu =
    scan.data?.pages.reduce((sum, page) => sum + (page.consumedCapacity?.rcu ?? 0), 0) ?? 0;
  const keys = described.data?.keySchema ?? [];
  const names = orderedAttributes(items, keys);
  const capped = cappedAttributes(names, prefs.revealed);
  const visible = capped.visible.filter((name) => !prefs.hidden.includes(name));
  const loaded = items.length;
  const showCost = endpoint !== undefined && !isLoopback(endpoint) && !costDismissed;

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

  function refresh(): void {
    void queryClient.resetQueries({
      queryKey: scanKeys.table(connectionId, table, query),
    });
  }

  if (mode === "query") {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Toolbar mode={mode} onMode={setMode} />
        <p className="px-4 py-6 text-sm">Query builder arrives in the next step</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-outline px-3 py-2">
        <Toolbar mode={mode} onMode={setMode} />
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
      {scan.isFetching ? <LinearProgress aria-label="Refreshing items" /> : null}
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
          <Button disabled>Delete</Button>
          <Button disabled>Copy</Button>
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {scan.isError ? (
          <div className="p-4">
            <ErrorState
              message={scan.error instanceof ApiError ? scan.error.message : "The scan failed."}
              details={scan.error instanceof Error ? scan.error.message : "The scan failed."}
              onRetry={() => {
                void scan.refetch();
              }}
            />
          </div>
        ) : scan.isPending ? (
          <p className="px-4 py-6 text-sm" role="status" aria-label="Loading items">
            Loading items
          </p>
        ) : loaded === 0 && scan.hasNextPage ? (
          <div className="px-4 py-6">
            <Button
              onClick={() => {
                void scan.fetchNextPage();
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
              <Button variant="contained" disabled>
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
              setDrawerOpen(true);
            }}
            onNearEnd={() => {
              if (scan.hasNextPage && !scan.isFetchingNextPage) {
                void scan.fetchNextPage();
              }
            }}
            scrollKey={`${connectionId}:${table}`}
          />
        )}
      </div>
      {loaded > 0 ? (
        <div className="flex items-center gap-3 border-t border-outline px-3 py-2">
          {scan.hasNextPage ? (
            <Button
              onClick={() => {
                void scan.fetchNextPage();
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
