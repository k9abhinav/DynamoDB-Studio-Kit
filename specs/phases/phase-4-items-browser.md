# Phase 4: Items Browser (the data grid)

**Goal:** A fast, beautiful, virtualized grid to scan and browse items with type-aware cells, filters, pagination, column control, and selection.
**Specs:** 01 (ITM-1..ITM-8), 04 (scan, shared Filter), 02 (ADR-004, 005, 5.2), 03 (DataGrid, ResultSummaryBar), Constitution Article VI.
**Skills:** dynamodb-expert, google-minimal-ui, quality-gates, spec-driven-workflow.

## 1. In scope
**Server:** `POST scan` with `limit`, `cursor`, `filters`, one `filterJoiner` for the list, `projection`, `consistentRead`, `index` (API and tests; the Items screen scans the base table and does not send it), `fillPage` loop that stops at the page size, 2 seconds, or 10 calls, whichever comes first; `ExpressionBuilder` for filters and projections (reserved words, nested paths); cursor codec; consumed capacity (`ReturnConsumedCapacity: TOTAL`); abort on client disconnect.
**Web:** `DataGrid` (TanStack Table + Virtual), `CellRenderer`, `TypeBadge`, `ColumnChooser`, `DensityToggle`, `FilterChip` + `FilterBuilderPopover`, `ResultSummaryBar`, `LoadMore`/infinite scroll, row selection + action bar skeleton (actions wired in Phase 5), "Items" tab, Scan mode only (Query mode UI in Phase 6, but the mode toggle and layout are present and the Query side shows "Query builder arrives in the next step" only if Phase 6 is not yet built).

## 2. Out of scope
Editing/deleting (Phase 5), query builder (Phase 6), export (Phase 7).

## 3. Functional requirements
- **FR-4.1** Grid columns are the union of attribute names seen so far; key attributes pinned first with key icon (partition then sort); remaining ordered by first-seen; column set updates as more pages load without jumping existing columns.
- **FR-4.2** Columns: resizable (drag + keyboard on header resize handle), reorderable not required, hide/show via ColumnChooser (search inside, "Reset", persisted per table in `localStorage` keyed by connection fingerprint and table, **no secrets**).
- **FR-4.3** Cell rendering by DynamoDB type (see ITM-3): strings plain with truncation + tooltip; numbers right-aligned mono; booleans as small chips; NULL as dim `null`; binary as `<binary 24 B>`; sets as `SS(3)`-style chip with tooltip preview; lists and maps as `[5 items]` / `{3 keys}` chips with tooltip JSON preview (first 300 chars); missing attribute shows empty cell (distinct from NULL).
- **FR-4.4** Virtualization: rows always; columns when > 40 columns. Sticky header and sticky pinned key columns. Scroll position preserved when returning to tab.
- **FR-4.5** Pagination: page size selector (25/50/100/500, default 50). Infinite scroll prefetches next page when within 10 rows of the end; a visible "Load more" button also exists for accessibility. End of data shows "End of results".
- **FR-4.6** Filters: add via "+ Filter" popover (attribute combobox with suggestions from loaded columns + free text, operator list adapted to value type, value input adapting to type, one AND/OR joiner for the whole list, up to 20). Filters render as chips; edit by click; delete via x; "Clear all". Applying filters resets pagination.
- **FR-4.7** Summary bar after each load: `Showing {loaded} · Scanned {scanned} · {RCU} RCU`; when a filter is active and scanned >> returned, show an informative tip once: "Filters run after reading items, so Scan still reads the whole page."
- **FR-4.8** Cost hint: on non-loopback endpoints, the first Scan on a table per session shows an inline, dismissible info bar about read cost (Constitution III.4).
- **FR-4.9** Refresh keeps filters and column choices, resets cursor; a toolbar progress bar shows fetching; in-flight request is aborted when parameters change.
- **FR-4.10** Selection: checkbox column, shift-click range, header checkbox selects all loaded, selected count in the action bar (`3 selected` with disabled placeholder buttons for Delete/Copy to be wired in Phase 5), `Esc` clears.
- **FR-4.11** Row activation (click or `Enter`) emits an `onOpenItem(key)` event (drawer implemented in Phase 5; in this phase open a read-only JSON preview drawer using a simple `<pre>`).
- **FR-4.12** Sorting: header click sorts **loaded rows client-side** and shows the label "Sorted locally (loaded items only)". No server sort for Scan.
- **FR-4.13** Accessibility: `role="grid"`, `aria-rowcount`/`aria-colcount`, roving tabindex, arrow-key cell navigation, `Home/End`, `PageUp/PageDown`, `Space` toggles selection, live region announces "50 items loaded".
- **FR-4.14** Large values: cells never render more than ~500 characters; row height fixed per density (no variable heights).
- **FR-4.15** Empty and error states: "This table is empty." (with Create item CTA placeholder until Phase 5), "No items match these filters." (with Clear filters), error state with retry.

## 4. Tasks
- [ ] T4.1 `ExpressionBuilder` (filters, projection, nested paths, reserved words, `in`, `between`, `type_is`) with table-driven unit tests (**write first**)
- [ ] T4.2 Cursor codec + tests
- [ ] T4.3 `DynamoService.scan` with consumed capacity, `fillPage` loop + budget + abort + tests; route + integration tests (filters, pagination boundaries, GSI scan, projection)
- [ ] T4.4 Web `useScanItems` infinite query + query keys + cancel + tests (MSW)
- [ ] T4.5 `DataGrid` core (virtual rows, sticky header, pinned columns, resize) + perf test harness
- [ ] T4.6 `CellRenderer` + `TypeBadge` + tooltip previews + tests for every type including edge-cases table
- [ ] T4.7 ColumnChooser + persistence + tests
- [ ] T4.8 Filters UI (popover, chips, validation, type-aware inputs) + tests
- [ ] T4.9 Pagination UX, summary bar, cost hint, empty/error states + tests
- [ ] T4.10 Selection model + action bar skeleton + tests
- [ ] T4.11 Keyboard + ARIA grid + live region + tests
- [ ] T4.12 Perf measurement: 10,000 rows scroll, record in metrics log; fix regressions
- [ ] T4.13 Playwright: browse `orders`, filter by `status`, hide columns, light/dark screenshots, axe, keyboard-only
- [ ] T4.14 Progress + phase summary

## 5. Acceptance criteria
- **AC-4.1** `orders` (10,000 items) loads in pages; scrolling to the end loads all 10,000 without UI jank (>= 55 fps measured, recorded).
- **AC-4.2** `edge-cases` table renders every DynamoDB type correctly and distinguishes missing vs `NULL` vs empty string (component + E2E).
- **AC-4.3** Filter `status = "SHIPPED"` returns only matching items; summary shows scanned > returned; reserved-word attribute (e.g. `status`, `name`) works (integration test).
- **AC-4.4** Nested path filter `address.city = "Pune"` works (integration test with seeded nested data).
- **AC-4.5** Aborting by changing page size cancels the previous request (test asserts abort signal fired and server stops looping).
- **AC-4.6** Column visibility and widths persist after reload and are table-specific.
- **AC-4.7** Selection supports shift-range and select-all-loaded; counts correct after loading more pages.
- **AC-4.8** Number precision: a 38-digit number displays exactly as stored (E2E on `edge-cases`).
- **AC-4.9** Keyboard-only navigation across cells/rows and opening an item works; axe 0 serious/critical (both themes).
- **AC-4.10** `ExpressionBuilder` has >= 95% branch coverage; no user text appears inside expression strings (property test: expression strings only contain `#n`/`:v` placeholders and operators).

## 6. Edge cases
Items with 500+ attributes (column cap: show first 200 columns with a "Show more columns" notice); 390 KB item (renders as chips, no freeze); attribute names with spaces/dots/unicode (placeholder aliasing); numbers like `1E+2`; scan with filter returning 0 items for many pages (`fillPage` budget returns partial with `hasMore=true` and a "Keep searching" button); consistent read on GSI (disabled with tooltip).

## 7. Definition of done
Standard phase DoD plus performance numbers recorded.
