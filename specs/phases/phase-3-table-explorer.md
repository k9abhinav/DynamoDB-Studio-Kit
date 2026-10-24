# Phase 3: Table Explorer

**Goal:** After connecting, see all tables, search them instantly, open several as tabs, and read a beautiful Overview of each table's structure.
**Specs:** 01 (TBL-1..TBL-3), 04 (Tables), 03 (sidebar, tabs, overview), 02 ADR-004/007.
**Skills:** dynamodb-expert, google-minimal-ui, quality-gates, spec-driven-workflow.

## 1. In scope
**Server:** `GET tables` (paged `ListTables` with server-side search), `GET tables/:table` (`DescribeTable` + `DescribeTimeToLive` + `DescribeContinuousBackups` not needed), normalization into the simplified `TableDescription` of `04`; `POST tables/:table/wait`.
**Web:** real Sidebar with search, refresh, counts, skeletons, infinite loading; table tabs (open, close, reorder not required, middle-click close, last-tab memory per table); Overview tab; Indexes tab (read-only list, create/delete in Phase 7); URL-driven selection `/c/:connId/t/:table/:tab`.

## 2. Out of scope
Items grid (Phase 4), create/delete table (Phase 7).

## 3. Functional requirements
- **FR-3.1** Sidebar loads the first page (<=100) quickly, then continues loading pages in the background up to 5,000 names; header shows `Tables (N)`; list is virtualized if N > 200.
- **FR-3.2** Search filters instantly on the client for loaded names and also triggers a server search when more pages exist; highlights matched substring; `Esc` clears; `Enter` opens first match; arrow keys move; list uses `role="listbox"`.
- **FR-3.3** Refresh button re-fetches with a rotating icon; keeps selection; new/removed tables animate subtly (opacity).
- **FR-3.4** Opening a table adds a tab (or focuses it if open). Closing the active tab selects its neighbor; closing the last returns to the empty state ("Pick a table to get started").
- **FR-3.5** Overview shows cards (Google-style, bordered): **Summary** (status chip, created, ARN with copy, deletion protection, item count + size with the "approximate" hint tooltip), **Keys** (partition key, sort key, types as TypeBadges), **Capacity** (billing mode, RCU/WCU if provisioned), **Indexes** (GSIs/LSIs: name, keys, projection, status with live backfill hint), **TTL**, **Streams**.
- **FR-3.6** `CREATING`/`UPDATING`/`DELETING` statuses show a friendly progress chip and the page auto-polls every 3s until `ACTIVE`.
- **FR-3.7** Non-existent table in URL shows `ErrorState` with "Back to tables".
- **FR-3.8** All requests cancel on navigation/unmount.

## 4. Tasks
- [x] T3.1 Shared schemas `TableDescription`, list responses + tests
- [x] T3.2 Server `DynamoService.listTables/describeTable` + normalization (unit tests with SDK mocks) + routes + integration tests
- [x] T3.3 Web query hooks (`useTables`, `useTable`), query keys, polling policy + tests
- [x] T3.4 Sidebar: search, keyboard nav, virtualization, highlight, refresh + tests
- [x] T3.5 Tabs: open/close/focus, URL sync, per-table last tab memory + tests
- [x] T3.6 Overview cards + TypeBadge + CopyButton + tests
- [x] T3.7 Indexes tab (read-only) + tests
- [x] T3.8 Status polling for transitional states + tests
- [x] T3.9 Playwright: open 3 tables, search, keyboard-only, light/dark screenshots, axe
- [x] T3.10 Progress + phase summary

## 5. Acceptance criteria
- **AC-3.1** With the seed DB, all four seed tables appear; typing `ord` leaves only `orders`; `Enter` opens it.
- **AC-3.2** With 1,000 generated tables the sidebar remains smooth and searchable (integration + component test with generated data).
- **AC-3.3** Overview shows correct keys/GSIs for `orders` (`userId`/`createdAt`, `status-createdAt-index`) (integration + E2E).
- **AC-3.4** TTL on `sessions` is displayed with attribute name and enabled state.
- **AC-3.5** Transitional status polling starts/stops correctly (fake timers test).
- **AC-3.6** Deep link to `/c/:id/t/orders/overview` works after refresh (session valid) and shows the friendly error when table is missing.
- **AC-3.7** Keyboard-only flow from search to open to switch tabs to close works; axe 0 serious/critical.
- **AC-3.8** Item count shows the "approximate" hint and never claims exactness.

## 6. Edge cases
Table names with dots/dashes; hundreds of tabs open (cap at 20 with friendly message to close one); `ListTables` pagination boundary (exactly 100); tables in `ARCHIVED`/`INACCESSIBLE_ENCRYPTION_CREDENTIALS` status (show warning state); empty account (empty state with "Create table" CTA that is disabled until Phase 7 and says "Coming soon" only if Phase 7 is not yet built).

## 7. Definition of done
Standard phase DoD.

## 8. Approved additions (2026-10-24)
- Bundle hygiene is already done (production `react-router`, lazy routes, `scripts/check-bundle.ts` on `pnpm verify`). Initial JS gzip before this phase is 179897 bytes. Record it again at the end of the phase.
- A test round-trips `my.table-v2` through the URL, the sidebar, and Overview.
- One Playwright test generates about 300 tables and checks virtualized scrolling, search, and keyboard navigation.
- A test asserts background table-list loading stops on disconnect, connection switch, and unmount.
