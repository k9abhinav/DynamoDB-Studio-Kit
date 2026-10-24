import {
  createCoreRowModel,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { AttributeValue } from "@dynamo-studio/shared";
import { compareAttributes, presentCell } from "./cell-text.js";
import { CellRenderer } from "./CellRenderer.js";
import { COLUMN_VIRTUAL_AFTER, itemKey, type KeyColumn } from "./columns.js";

type Row = Record<string, AttributeValue>;

const SELECT = 48;
const MIN_WIDTH = 80;
const gridFeatures = tableFeatures({
  coreRowModel: createCoreRowModel(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export function DataGrid({
  items,
  columns,
  keys,
  widths,
  onWidth,
  rowPx,
  selected,
  onSelected,
  onOpen,
  onNearEnd,
  scrollKey,
}: {
  items: readonly Row[];
  columns: readonly string[];
  keys: readonly KeyColumn[];
  widths: Readonly<Record<string, number>>;
  onWidth: (name: string, width: number) => void;
  rowPx: number;
  selected: ReadonlySet<string>;
  onSelected: (ids: ReadonlySet<string>) => void;
  onOpen: (item: Row) => void;
  onNearEnd?: () => void;
  scrollKey?: string;
}) {
  const keyNames = keys.map((key) => key.name);
  const pinned = keyNames.filter((name) => columns.includes(name));
  const rest = columns.filter((name) => !pinned.includes(name));
  const defs = useMemo<ColumnDef<typeof gridFeatures, Row>[]>(
    () =>
      columns.map((name) => ({
        id: name,
        accessorFn: (row) => row[name],
        header: name,
        enableSorting: true,
        sortUndefined: false,
        sortFn: (left, right) => compareAttributes(left.original[name], right.original[name]),
      })),
    [columns],
  );
  const table = useTable({
    features: gridFeatures,
    data: items,
    columns: defs,
    getRowId: (row) => itemKey(row, keyNames),
  });
  const sorting = table.state.sorting;
  const keySignature = keyNames.join("\u0000");
  const plainRows = useMemo(
    () =>
      items.map((item) => ({
        id: itemKey(item, keySignature.length === 0 ? [] : keySignature.split("\u0000")),
        original: item,
      })),
    [items, keySignature],
  );
  const rows =
    sorting.length === 0
      ? plainRows
      : table.getRowModel().rows.map((row) => ({ id: row.id, original: row.original }));
  return (
    <VirtualFrame
      rows={rows}
      columns={columns}
      pinned={pinned}
      rest={rest}
      widths={widths}
      onWidth={onWidth}
      rowPx={rowPx}
      selected={selected}
      onSelected={onSelected}
      onOpen={onOpen}
      onNearEnd={onNearEnd}
      scrollKey={scrollKey}
      sorting={sorting}
      onSort={(name) => {
        table.getColumn(name)?.toggleSorting();
      }}
    />
  );
}

function VirtualFrame({
  rows,
  columns,
  pinned,
  rest,
  widths,
  onWidth,
  rowPx,
  selected,
  onSelected,
  onOpen,
  onNearEnd,
  scrollKey,
  sorting,
  onSort,
}: {
  rows: readonly { id: string; original: Row }[];
  columns: readonly string[];
  pinned: readonly string[];
  rest: readonly string[];
  widths: Readonly<Record<string, number>>;
  onWidth: (name: string, width: number) => void;
  rowPx: number;
  selected: ReadonlySet<string>;
  onSelected: (ids: ReadonlySet<string>) => void;
  onOpen: (item: Row) => void;
  onNearEnd: (() => void) | undefined;
  scrollKey: string | undefined;
  sorting: readonly { id: string; desc: boolean }[];
  onSort: (name: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<string | null>(null);
  const [focus, setFocus] = useState({ row: 0, col: 1 });
  const testRect = virtualizerTestRect();
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual's supported API
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowPx,
    overscan: 4,
    ...testRect,
  });
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    enabled: rest.length > COLUMN_VIRTUAL_AFTER,
    count: rest.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => widths[rest[index] ?? ""] ?? 160,
    overscan: 2,
    scrollMargin: SELECT + pinned.reduce((sum, name) => sum + (widths[name] ?? 160), 0),
    ...testRect,
  });
  const askedNearEnd = useRef(false);
  useEffect(() => {
    askedNearEnd.current = false;
  }, [rows.length]);
  useEffect(() => {
    const node = parentRef.current;
    if (node === null || scrollKey === undefined) {
      return;
    }
    node.scrollTop = scrollMemory.get(scrollKey) ?? 0;
    return () => {
      scrollMemory.set(scrollKey, node.scrollTop);
    };
  }, [scrollKey]);
  useEffect(() => {
    if (onNearEnd === undefined || askedNearEnd.current) {
      return;
    }
    const last = rowVirtualizer.getVirtualItems().at(-1);
    if (last !== undefined && rows.length - 1 - last.index <= 10) {
      askedNearEnd.current = true;
      onNearEnd();
    }
  });
  const virtualColumns = rest.length > COLUMN_VIRTUAL_AFTER;
  const tableWidth = SELECT + columns.reduce((sum, name) => sum + (widths[name] ?? 160), 0);
  const ids = rows.map((row) => row.id);

  function toggle(id: string, shift: boolean): void {
    const next = new Set(selected);
    if (shift && anchor.current !== null) {
      const start = ids.indexOf(anchor.current);
      const end = ids.indexOf(id);
      if (start >= 0 && end >= 0) {
        const [from, to] = start < end ? [start, end] : [end, start];
        for (const key of ids.slice(from, to + 1)) {
          next.add(key);
        }
        onSelected(next);
        return;
      }
    }
    anchor.current = id;
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelected(next);
  }

  function move(nextRow: number, nextCol: number): void {
    const row = Math.max(0, Math.min(rows.length - 1, nextRow));
    const col = Math.max(0, Math.min(columns.length, nextCol));
    setFocus({ row, col });
    rowVirtualizer.scrollToIndex(row);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const page = Math.max(1, Math.floor((parentRef.current?.clientHeight || 400) / rowPx) - 1);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(focus.row + 1, focus.col);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(focus.row - 1, focus.col);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(focus.row, focus.col + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(focus.row, focus.col - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(focus.row, 0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(focus.row, columns.length);
    } else if (event.key === "PageDown") {
      event.preventDefault();
      move(focus.row + page, focus.col);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      move(focus.row - page, focus.col);
    } else if (event.key === " ") {
      event.preventDefault();
      const id = ids[focus.row];
      if (id !== undefined) {
        toggle(id, event.shiftKey);
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[focus.row];
      if (row !== undefined) {
        onOpen(row.original);
      }
    } else if (event.key === "Escape") {
      onSelected(new Set());
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {sorting.length > 0 ? (
        <p className="px-3 py-1 text-xs text-text-secondary">Sorted locally (loaded items only)</p>
      ) : null}
      <div
        ref={parentRef}
        role="grid"
        aria-label="Items"
        aria-rowcount={rows.length + 1}
        aria-colcount={columns.length + 1}
        tabIndex={rows.length === 0 ? 0 : -1}
        className="min-h-0 flex-1 overflow-auto outline-none"
        onKeyDown={onKeyDown}
      >
        <div
          role="row"
          className="sticky top-0 z-20 flex border-b border-outline bg-surface"
          style={{ width: tableWidth }}
        >
          <SelectCell
            checked={rows.length > 0 && rows.every((row) => selected.has(row.id))}
            label="Select all loaded items"
            left={0}
            onChange={() => {
              onSelected(rows.every((row) => selected.has(row.id)) ? new Set() : new Set(ids));
            }}
          />
          {pinned.map((name, index) => (
            <HeaderCell
              key={name}
              name={name}
              width={widths[name] ?? 160}
              left={offset(pinned, widths, index)}
              placed="sticky"
              sorted={sorting.some((entry) => entry.id === name)}
              onSort={() => {
                onSort(name);
              }}
              onWidth={onWidth}
            >
              {name}
            </HeaderCell>
          ))}
          {(virtualColumns
            ? columnVirtualizer.getVirtualItems()
            : rest.map((_name, index) => ({ index, start: 0 }))
          ).map((entry) => {
            const name = rest[entry.index] ?? "";
            return (
              <HeaderCell
                key={name}
                name={name}
                width={widths[name] ?? 160}
                placed={virtualColumns ? "absolute" : "flow"}
                left={virtualColumns ? entry.start : undefined}
                sorted={sorting.some((item) => item.id === name)}
                onSort={() => {
                  onSort(name);
                }}
                onWidth={onWidth}
              >
                {name}
              </HeaderCell>
            );
          })}
        </div>
        <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (row === undefined) {
              return null;
            }
            return (
              <div
                key={row.id}
                role="row"
                aria-selected={selected.has(row.id)}
                className={`absolute top-0 left-0 flex border-b border-outline ${
                  selected.has(row.id) ? "bg-primary-container" : "bg-surface"
                }`}
                style={{
                  height: rowPx,
                  width: tableWidth,
                  transform: `translateY(${String(virtualRow.start)}px)`,
                }}
              >
                <ItemRow
                  row={row}
                  index={virtualRow.index}
                  checked={selected.has(row.id)}
                  focusRow={focus.row}
                  focusCol={focus.col}
                  pinned={pinned}
                  rest={rest}
                  widths={widths}
                  entries={virtualColumns ? columnVirtualizer.getVirtualItems() : undefined}
                  onOpen={onOpen}
                  onToggle={toggle}
                  onFocusCell={setFocus}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ItemRow = memo(
  function ItemRow({
    row,
    index,
    checked,
    focusRow,
    focusCol,
    pinned,
    rest,
    widths,
    entries,
    onOpen,
    onToggle,
    onFocusCell,
  }: {
    row: { id: string; original: Row };
    index: number;
    checked: boolean;
    focusRow: number;
    focusCol: number;
    pinned: readonly string[];
    rest: readonly string[];
    widths: Readonly<Record<string, number>>;
    entries: readonly { index: number; start: number }[] | undefined;
    onOpen: (item: Row) => void;
    onToggle: (id: string, shift: boolean) => void;
    onFocusCell: (focus: { row: number; col: number }) => void;
  }) {
    const shown = entries ?? rest.map((_name, itemIndex) => ({ index: itemIndex, start: 0 }));
    return (
      <>
        <SelectCell
          checked={checked}
          label={`Select row ${String(index + 1)}`}
          left={0}
          tabIndex={focusRow === index && focusCol === 0 ? 0 : -1}
          onChange={(shift) => {
            onFocusCell({ row: index, col: 0 });
            onToggle(row.id, shift);
          }}
        />
        {pinned.map((name, pinnedIndex) => (
          <DataCell
            key={name}
            width={widths[name] ?? 160}
            left={offset(pinned, widths, pinnedIndex)}
            placed="sticky"
            label={distinguishingLabel(row.original[name])}
            focused={focusRow === index && focusCol === pinnedIndex + 1}
            onFocus={() => {
              onFocusCell({ row: index, col: pinnedIndex + 1 });
            }}
            onOpen={() => {
              onOpen(row.original);
            }}
          >
            <CellRenderer value={row.original[name]} />
          </DataCell>
        ))}
        {shown.map((entry) => {
          const name = rest[entry.index] ?? "";
          const col = pinned.length + entry.index + 1;
          return (
            <DataCell
              key={name}
              width={widths[name] ?? 160}
              placed={entries === undefined ? "flow" : "absolute"}
              left={entries === undefined ? undefined : entry.start}
              label={distinguishingLabel(row.original[name])}
              focused={focusRow === index && focusCol === col}
              onFocus={() => {
                onFocusCell({ row: index, col });
              }}
              onOpen={() => {
                onOpen(row.original);
              }}
            >
              <CellRenderer value={row.original[name]} />
            </DataCell>
          );
        })}
      </>
    );
  },
  (prev, next) =>
    prev.row === next.row &&
    prev.checked === next.checked &&
    prev.focusRow === next.focusRow &&
    prev.focusCol === next.focusCol &&
    prev.pinned === next.pinned &&
    prev.rest === next.rest &&
    prev.widths === next.widths &&
    prev.entries === next.entries,
);

function offset(
  pinned: readonly string[],
  widths: Readonly<Record<string, number>>,
  index: number,
): number {
  let left = SELECT;
  for (let cursor = 0; cursor < index; cursor += 1) {
    left += widths[pinned[cursor] ?? ""] ?? 160;
  }
  return left;
}

function HeaderCell({
  name,
  width,
  left,
  placed,
  sorted,
  onSort,
  onWidth,
  children,
}: {
  name: string;
  width: number;
  left: number | undefined;
  placed: "sticky" | "absolute" | "flow";
  sorted: boolean;
  onSort: () => void;
  onWidth: (name: string, width: number) => void;
  children: ReactNode;
}) {
  return (
    <div
      role="columnheader"
      aria-sort={sorted ? "ascending" : "none"}
      className={`flex shrink-0 items-center border-r border-outline bg-surface px-2 text-xs font-medium ${
        placed === "sticky" ? "sticky z-30" : ""
      } ${placed === "absolute" ? "absolute top-0 h-full" : "relative"}`}
      style={{ width, ...(left === undefined ? {} : { left }) }}
    >
      <button type="button" className="truncate" onClick={onSort}>
        {children}
      </button>
      <button
        type="button"
        aria-label={`Resize ${name}`}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            onWidth(name, width + 16);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            onWidth(name, Math.max(MIN_WIDTH, width - 16));
          }
        }}
        onPointerDown={(event) => {
          const start = event.clientX;
          const target = event.currentTarget;
          if (typeof target.setPointerCapture === "function") {
            target.setPointerCapture(event.pointerId);
          }
          const move = (pointer: PointerEvent) => {
            onWidth(name, Math.max(MIN_WIDTH, width + pointer.clientX - start));
          };
          const stop = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", stop);
          };
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", stop);
        }}
      />
    </div>
  );
}

function DataCell({
  width,
  left,
  placed,
  label,
  focused,
  onFocus,
  onOpen,
  children,
}: {
  width: number;
  left: number | undefined;
  placed: "sticky" | "absolute" | "flow";
  label: string | undefined;
  focused: boolean;
  onFocus: () => void;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="gridcell"
      tabIndex={focused ? 0 : -1}
      aria-label={label}
      className={`flex shrink-0 items-center border-r border-outline px-2 ${
        placed === "sticky" ? "sticky z-10 bg-inherit" : ""
      } ${placed === "absolute" ? "absolute top-0 h-full" : ""}`}
      style={{ width, ...(left === undefined ? {} : { left }) }}
      onFocus={onFocus}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
    </div>
  );
}

function SelectCell({
  checked,
  label,
  left,
  tabIndex = -1,
  onChange,
}: {
  checked: boolean;
  label: string;
  left: number;
  tabIndex?: number;
  onChange: (shift: boolean) => void;
}) {
  return (
    <div
      role="gridcell"
      className="sticky z-10 flex shrink-0 items-center justify-center border-r border-outline bg-inherit"
      style={{ width: SELECT, left }}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        tabIndex={tabIndex}
        onPointerDown={(event) => {
          event.currentTarget.dataset.shift = event.shiftKey ? "1" : "0";
        }}
        onChange={(event) => {
          onChange(event.currentTarget.dataset.shift === "1");
        }}
      />
    </div>
  );
}

const scrollMemory = new Map<string, number>();

function distinguishingLabel(value: AttributeValue | undefined): string | undefined {
  const label = presentCell(value).label;
  if (label === "Missing" || label === "Null" || label === "Empty string") {
    return label;
  }
  return undefined;
}

function virtualizerTestRect():
  | {
      observeElementRect: (
        instance: unknown,
        callback: (rect: { width: number; height: number }) => void,
      ) => () => void;
    }
  | undefined {
  if (import.meta.env.MODE !== "test") {
    return undefined;
  }
  return {
    observeElementRect: (_instance, callback) => {
      callback({ width: 800, height: 400 });
      return () => undefined;
    },
  };
}
