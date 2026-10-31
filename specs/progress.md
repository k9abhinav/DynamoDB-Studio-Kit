# Progress Tracker

> The agent updates this file at the end of every task and phase. It is the memory between sessions.
> Format for evidence: `AC-3.2 ✔ apps/web/src/features/tables/SidebarTableList.test.tsx > "filters as you type"`

**Current phase:** 7
**Last updated:** 2026-10-27

## Phase status
| Phase | Name | Status | Verify green | Date |
|---|---|---|---|---|
| 0 | Foundation | ✅ done | ✅ | 2026-10-23 |
| 1 | Design system & app shell | ✅ done | ✅ | 2026-10-23 |
| 2 | Backend & connection | ✅ done | ✅ | 2026-10-23 |
| 3 | Table explorer | ✅ done | ✅ | 2026-10-24 |
| 4 | Items browser | ✅ done | ✅ | 2026-10-24 |
| 5 | Item editor & CRUD | ✅ done | ✅ | 2026-10-25 |
| 6 | Query builder & PartiQL | ✅ done | ✅ | 2026-10-26 |
| 7 | Table management & import/export | ☐ not started | ☐ | |
| 8 | Polish, hardening, packaging | ☐ not started | ☐ | |

## Phase 2 tasks
- [x] T2.1 Shared schemas
- [x] T2.2 Security plugin
- [x] T2.3 ErrorMapper
- [x] T2.4 Endpoint normalizer
- [x] T2.5 ConnectionManager and routes
- [x] T2.6 ProfileStore
- [x] T2.7 Read-only guard
- [x] T2.8 Web API client
- [x] T2.9 URL parsing util
- [x] T2.10 Connect card
- [x] T2.11 Saved connections
- [x] T2.12 Workspace guard and heartbeat
- [x] T2.13 Playwright
- [x] T2.14 Security checklist
- [x] T2.15 Progress summary

## Phase 3 tasks
- [x] T3.1 Shared schemas
- [x] T3.2 Server list and describe
- [x] T3.3 Web query hooks
- [x] T3.4 Sidebar
- [x] T3.5 Tabs
- [x] T3.6 Overview
- [x] T3.7 Indexes tab
- [x] T3.8 Status polling
- [x] T3.9 Playwright
- [x] T3.10 Progress summary

## Phase 4 tasks
- [x] T4.1 Expression builder
- [x] T4.2 Cursor codec
- [x] T4.3 Scan service, route, and integration
- [x] T4.4 Web scan query
- [x] T4.5 Data grid
- [x] T4.6 Cells and type badges
- [x] T4.7 Column chooser
- [x] T4.8 Filters
- [x] T4.9 Pagination and states
- [x] T4.10 Selection
- [x] T4.11 Keyboard and ARIA
- [x] T4.12 Scroll performance
- [x] T4.13 Playwright
- [x] T4.14 Progress summary

T4.1 ✔ `apps/server/src/dynamo/expression-builder.test.ts`. Branch coverage 100% (99/99) on 2026-10-24 with `@vitest/coverage-v8` for `expression-builder.ts`. A 38-digit number and `1E+2` stay decimal strings in the value map.

## Phase 5 tasks
- [x] T5.1 Typed JSON plain projection
- [x] T5.2 Validation, hash, and size
- [x] T5.3 Item routes
- [x] T5.4 Batch delete
- [x] T5.5 Web mutations
- [x] T5.6 JSON editor
- [x] T5.7 Item drawer
- [x] T5.8 Create and duplicate
- [x] T5.9 Delete and undo
- [x] T5.10 Conflict dialog
- [x] T5.11 Copy menu
- [x] T5.12 Read-only and unsaved guard
- [x] T5.13 Playwright
- [x] T5.14 Progress summary

## Phase 6 tasks
- [x] T6.1 Key-condition builder
- [x] T6.2 Server query route
- [x] T6.3 PartiQL classifier
- [x] T6.4 PartiQL route
- [x] T6.5 Query builder
- [x] T6.6 Scan/Query toggle
- [x] T6.7 PartiQL editor
- [x] T6.8 History and saved queries
- [x] T6.9 Mutation confirmation
- [x] T6.10 Playwright
- [x] T6.11 Progress summary

## Phase 7 tasks
- [x] T7.1 Shared schemas
- [x] T7.2 Server create/update/delete
- [x] T7.3 Streaming serializers
- [x] T7.4 Server export
- [x] T7.5 Streaming parsers
- [x] T7.6 Server import
- [x] T7.7 Clear table
- [x] T7.8 Create table wizard
- [x] T7.9 Indexes, TTL, billing
- [x] T7.10 Export dialog
- [x] T7.11 Import wizard
- [x] T7.12 Delete and clear dialogs
- [x] T7.13 Playwright
- [ ] T7.14 Progress summary

T7.13 ✔ `e2e/manage.spec.ts`. The keyboard opens the wizard, types the name and partition key, and creates a table with TTL `expiresAt` and index `kind-index`. A two-row CSV imports, a query for that partition key shows the value, the NDJSON download contains it, and deleting the table asks for the typed name. A read-only connection disables create, import, clear, and delete, and leaves export enabled. axe reports 0 serious or critical on the overview, create wizard, and import dialog in light and dark. Screenshots are in `docs/screenshots/phase-7/`.

T7.12 ✔ `TransferMenu.test.tsx`. Delete and clear stay disabled until the table name is typed, in every environment. Delete shows the approximate item count. A protection failure shows "Deletion protection is on. Turn it off, then delete the table." Import, clear, and delete are disabled on a read-only connection with "This connection is read-only".

T7.11 ✔ `ImportWizard.test.tsx`. A CSV preview keeps columns as strings and says `007` stays a string unless mapped to N. The wizard says skip-existing is slower. Closing the tab during an import is cancelled with "Import in progress". A failed row offers the error report download. The toast stays mounted in the workspace, so it remains after the wizard closes.

T7.10 ✔ `ExportDialog.test.tsx`. This view sends a scan with no cursor. A full export outside loopback stays disabled until the table name is typed and says the read can be expensive. Cancel aborts the request. The progress toast stays in the workspace and links back to the table. CSV export warns that nested values become JSON text. PartiQL offers entire-table export only.

T7.9 ✔ `TableControls.test.tsx`. Turning on deletion protection sends `{ deletionProtection: true }`. A `CREATING` index disables Add index and says to wait until it is ACTIVE, including the backfill note. A read-only connection disables the protection switch and Add index. Overview and Indexes both render these controls. Existing table polling already refreshes the description every 3 seconds.

T7.8 ✔ `CreateTableWizard.test.tsx` walks Keys, Options, and Review, shows the DynamoDB request, and navigates to the new table's Overview. The sidebar Create table button opens that wizard. A read-only connection disables the button.

T7.7 ✔ `clear.int.test.ts`. A wrong typed name is 400, a read-only connection is 403 before any delete, and confirming the table name removes the two items. `clear-table.test.ts` stops before the next page when the request is aborted.

T7.6 ✔ Overwrite uses `BatchWriteItem` batches of 25 with backoff. Skip-existing uses conditional `PutItem` at concurrency 4; `ConditionalCheckFailed` is a skip, and a later copy of a key this import already wrote is a plain put. `import.int.test.ts` re-imports all 10,000 orders and matches item hashes, counts a duplicate, and returns 404 for another session's error report. A multipart import without the CSRF header is 401. A generated 104,870,400-byte dry run left the live heap smaller than it started (heapUsed 30,239,080 → 28,209,560) and external memory at 5,097,376 bytes. RSS rose to a peak of 460,275,712 and stayed at 447,430,656 after garbage collection because the process did not return those pages to the OS.

T7.5 ✔ `import-parse.test.ts` (4). UTF-8 BOM is stripped, UTF-16 is rejected, CRLF lines split, quoted CSV keeps commas, quotes, newlines, and `007` as a string, a short row names the missing column, and a JSON array can contain `}` inside a string. Missing keys and items over 400 KB are row errors.

T7.4 ✔ `apps/server/src/routes/export.int.test.ts` > "exports all 10,000 orders as NDJSON plus a summary line". The body has 10,000 item lines and `{"__summary":{"items":10000}}`. `export-stream.test.ts` stops at `maxItems` and stops before the next page when the request is aborted.

T7.3 ✔ `apps/server/src/dynamo/export-format.test.ts`. CSV escapes quotes, commas, newlines, and unicode, writes a 38-digit number as digits, and flattens a nested map to a JSON string with a warning. A later column lands in `_extra`. Plain NDJSON ends with `{"__summary":...}`. A typed JSON array does not. An empty JSON export is `[]`.

T7.2 ✔ `apps/server/src/routes/manage-tables.int.test.ts` and `apps/server/src/dynamo/manage-table.test.ts`. Create returns 202 with a GSI, TTL, and deletion protection. A duplicate name is "That table name is already in use." A wrong confirm does not delete. Deletion protection returns the friendly message and keeps `ValidationException` in details. Read-only create is 403. GSI delete and create run one at a time. Provisioned billing is switched on a table without a GSI: DynamoDB Local returns `InternalFailure` when a table that already has a GSI changes billing mode. A deleting index whose attribute definition has already disappeared stays visible as `DELETING` so the next index change is refused.

T7.1 ✔ `packages/shared/src/api/create-table.test.ts` and `transfer.test.ts`. Invalid names, duplicate indexes, on-demand capacity, and an empty update are rejected. `buildCreateTableRequest` emits CreateTable plus UpdateTimeToLive, copies provisioned capacity onto an index that omits its own, and includes no credentials. Export defaults to plain NDJSON and rejects a view cursor. CSV import requires a mapping. Import events carry `duplicates`. `MAX_IMPORT_BYTES` is 512 MB.

T6.1 ✔ `packages/shared/src/query-request.test.ts` and `apps/server/src/dynamo/expression-builder.test.ts` > "aliases reserved words and rejects begins_with on a number". Partition-key equality and every sort-key operator use `#n` / `:v` placeholders. `status`, `name`, and `timestamp` stay in the names map. A 38-digit number and `1E+2` are unchanged. `begins_with` accepts string and binary and rejects a number. The server wrapper maps that rejection to `400 VALIDATION`.

T6.11 ✔ This file. `pnpm verify` on 2026-10-26 is green: lint, typecheck, 295 unit tests, 10 integration tests, and the production build. Initial JavaScript gzip is 181399 bytes. `pnpm exec playwright test --workers=1` passed 33 tests. A leftover `p5-conflict-*` item in `edge-cases` made the first integration run expect 11 items; it was deleted, and the seed test then expected 10. Frozen install was not run. A live screen reader was not used. `actionlint` is not on PATH.

T6.10 ✔ `e2e/query.spec.ts`. `Control+Enter` queries `orders` for `user-0001`, then `createdAt BETWEEN` descending. The GSI `status-createdAt-index` query uses `begins_with` on `createdAt`, disables consistent read, and returns 50 `SHIPPED` items. Show request includes the key condition and an AWS CLI command without credentials. PartiQL selects by partition key, keeps the statement in history, inserts `p6-e2e`, and deletes it. axe reports 0 serious or critical violations on the query view and the PartiQL view in light and dark. Screenshots: `docs/screenshots/phase-6/query-light.png`, `query-dark.png`, `partiql-light.png`, `partiql-dark.png`. At 200% zoom the Run query button stays visible.

T6.7 ✔ `apps/web/src/features/partiql/PartiqlPanel.test.tsx` and `PartiqlCodeEditor.test.tsx`. The editor is a lazy chunk with a small Monarch grammar. Templates quote the current table. The panel test confirms a mutation, stores history, and clears it. `PartiqlPanel.test.tsx` > "stops a running statement and returns to idle" clicks Stop, sees the request abort signal fire, and expects Stop disabled with "Run a statement to see items." The server page loop is `partiql.test.ts`. A SELECT without WHERE on a non-loopback endpoint shows the scan cost hint in the panel; that hint is not covered by the panel test. `PartiqlCodeEditor.test.tsx` injects line 2, column 4 and checks the Monaco marker. DynamoDB Local's syntax error has no position, and AWS was not checked.

T6.9 ✔ The same panel test. An UPDATE opens a confirmation dialog that names the verb. Production types the quoted table name (`users`). The request then sends `X-DS-Confirm: mutation`. The snackbar says the statement ran when DynamoDB does not return an affected count.

T6.8 ✔ `apps/web/src/features/partiql/partiql-storage.test.ts`. History keeps 100 statements, drops a consecutive duplicate after turning `\r\n` into `\n`, and uses schema `{ v: 1 }`. The storage key is `ds-partiql-history:` plus the SHA-256 of the endpoint and region, so the endpoint is not in the key or the value. Clear history removes that key and `ds-partiql-saved:`.

T6.6 ✔ `apps/web/src/features/items/ItemsPanel.test.tsx` > "runs a query in the same grid and clears filters unless asked". The query result uses the scan grid. Page size stays available. Filters clear on Scan/Query unless Keep filters is checked. `Cmd/Ctrl+Enter` runs the query from `QueryBuilder.test.tsx`.

T6.5 ✔ `apps/web/src/features/items/query-form.test.ts` and `QueryBuilder.test.tsx`. Run stays disabled until the partition key has a value, and the hint names Scan. A number stays text, including `1E+2` and a 38-digit value. Hex `62` becomes base64 `Yg==`. `begins_with` on a number is rejected by the shared key builder. Consistent read is disabled on a GSI with the tooltip "Consistent read is not available on a global secondary index." Show request prints the server preview JSON, and the AWS CLI tab has no credentials.

T6.4 ✔ `apps/server/src/routes/partiql.int.test.ts` and `apps/server/src/dynamo/partiql.test.ts`. A parameterized `SELECT` returns `user-0001`. `NextToken` pages `users`, and reusing that cursor with a different statement is `400 VALIDATION`. The cursor hash also covers parameters and consistent read: changing either one, with the statement held the same, is `400 VALIDATION` and does not call DynamoDB. An `UPDATE` on a read-only connection is `403 READ_ONLY`. A writable `UPDATE` without `X-DS-Confirm: mutation` is `400 VALIDATION`. A `DELETE` sent with `X-DS-Confirm: select` is still a mutation and is `400 VALIDATION`; the item stays until the header is `mutation`. A statement over 8192 bytes is `LIMIT_EXCEEDED`. Aborting the request ends the page loop after one call. DynamoDB Local's syntax error (`SELECT * FROM "users" WHERE`) is `PARTIQL_ERROR` and includes no position. AWS was not checked.

T6.3 ✔ `packages/shared/src/partiql.test.ts`. The classifier tokenizes, so comments and quotes are not scanned as keywords. `select`, `SELECT`, leading whitespace, `-- DELETE`, a block comment, and `'DELETE'` are selects. `UPDATE`, `INSERT`, and `DELETE` are mutations. Empty input, `SELEC`, two statements separated by `;`, an unclosed string, and an unclosed comment are mutations.

T6.2 ✔ `apps/server/src/dynamo/query.test.ts` and `apps/server/src/routes/query.int.test.ts` against DynamoDB Local. Descending `userId = user-0001` with `createdAt BETWEEN` returns those orders. `status-createdAt-index` with `begins_with` returns `SHIPPED` items. Consistent read on that GSI is `400 VALIDATION` before Query. Filters on `name` and `timestamp` use their own placeholders after the key aliases, so the names map contains `userId`, `name`, and `timestamp`. A cursor from a descending query is `400 VALIDATION` when the direction changes. The seed has no LSI, so consistent read on a local index was not exercised.

T5.1 ✔ `packages/shared/src/typed-json.test.ts`. 1,000 generated items and the edge fixtures round-trip through `lossless-json`, including a 38-digit number, `1E+2`, `-0`, and `$b` keys. `lossless-json` 4.3.3 is the approved parser. `fast-check` 4.10.2 is a shared dev dependency for that property test.

T5.2 ✔ `packages/shared/src/item-check.test.ts`. Empty sets, duplicate members, bad numbers, bad binary, depth 33, and a changed key are errors. A 390,000-character string stays under 400 KB. The hash is SHA-256 base64url of canonical typed JSON, so `1E+2` does not match `100`.

T5.3 ✔ `apps/server/src/routes/items.int.test.ts` against DynamoDB Local. Read-only writes return 403. A changed key is 400 VALIDATION. A hash mismatch is 409. An item over 400 KB is LIMIT_EXCEEDED before PutItem. A second create says an item with this key already exists. Deleting a missing item returns `{ deleted: false }`. DynamoDB rewrites `1E+2` to `100`, and the returned hash is of that stored item.

T5.4 ✔ `apps/server/src/dynamo/batch-delete.test.ts` retries one unprocessed key, caps each request at 25, and stops after an abort. The same integration file deletes 3 real users. `specs/04-api-contract.md` records that each request still accepts at most 500 keys and that the client sends chunks of 25.

T5.5 ✔ `apps/web/src/features/items/use-item-mutations.test.tsx`. A failed save restores the scan row. Undo sends the saved hash and records a conflict on 409. Bulk delete requests are chunks of 25 and a cancelled signal sends nothing further.

T5.6 ✔ `apps/web/src/features/items/EditorPane.test.tsx`. Monaco is loaded from the local `monaco-editor` package (`loader.config({ monaco })`) with ES module workers for Chrome and Firefox. View mode does not import it. If that chunk fails, a textarea remains. `monaco-editor` 0.57.0 and `@monaco-editor/react` 4.7.0 are bundled so the editor never fetches a CDN.

T5.7 ✔ `apps/web/src/features/items/editor-text.test.ts` and `ItemsPanel.test.tsx`. Opening a row shows plain JSON, so `1E+2` stays text. A changed key or an empty set blocks save. Save sends the hash from when the item was opened.

T5.8 ✔ `editor-text.test.ts`. A new item starts with an empty string key or `"0"` for a number key, so save stays disabled until the key is filled. Duplicate copies the other attributes and clears the key. A collision says an item with this key already exists and offers Open existing item.

T5.9 ✔ `delete-confirm.test.ts`. One item confirms normally. Production types the table name. More than 25 items types DELETE. Undo of a delete puts the previous item back with `ifNotExists`. A missing item says Already deleted. Bulk delete shows progress and can be cancelled between chunks.

T5.10 ✔ `ConflictDialog.test.tsx`. A hash mismatch shows your edit and the latest item, says the check is best-effort, and offers Reload latest or Overwrite. Overwrite saves without the hash but still requires the item to exist.

T5.11 ✔ `copy-command.test.ts`. The AWS CLI command single-quotes quotes, unicode, and newlines, adds `--endpoint-url` only for a non-AWS host, and never includes credentials.

T5.12 ✔ `ItemDrawer.test.tsx`. Closing the drawer with unsaved edits asks "Discard changes?" before the drawer goes away. Read-only connections disable Edit, Duplicate, Delete, and Create with the tooltip "This connection is read-only". Navigation away is blocked the same way. The server still returns 403 for a read-only write.

T5.13 ✔ `e2e/items-edit.spec.ts` (7 tests) and `scripts/check-bundle.test.ts`. Edit, undo, a second-session conflict, a create collision, a production typed delete, and a 100-item delete all ran in Chromium. Saving through the textarea fallback kept the string, the number (`100`), and the string set. A 390 KB item saved and undid; growing it past 400 KB disabled Save and showed the limit message. The open drawer had no serious or critical axe violations in light or dark, and Escape returned focus to the `large` cell. Screenshots are `docs/screenshots/phase-5/item-drawer-light.png` and `item-drawer-dark.png`. Monaco's package exports do not expose `esm/vs/...` or the CSS file, so the workers import `monaco-editor/editor/editor.worker` and `monaco-editor/language/json/json.worker`, and Vite aliases the CSS onto the real file. The entry-script check rejects `monaco-editor` and `MonacoEnvironment`.

T5.14 ✔ This file. EDT-7 stays in `specs/backlog.md`. The JSON drawer already creates, edits, duplicates, and deletes, and `ItemEditor.tsx` is past the size where a second attribute editor belongs in this phase.

Follow-up ✔ `apps/server/src/routes/items.int.test.ts` > "round-trips every edge-cases item through plain JSON and the update route". Plain JSON keeps `1E+2` and a `$b` key. DynamoDB stores that number as `100`. Each seed edge-cases item is copied onto its own id, written back, and deleted in `finally`. The copy keeps sets, binary, the 38-digit number, and empty strings. The seed rows are only read.

Follow-up ✔ `e2e/items-edit.spec.ts` > "disables writes on a read-only connection". Create, the selection Delete, and the drawer Edit, Duplicate, and Delete are disabled. Each tooltip says "This connection is read-only". `PUT .../items` returns 403 READ_ONLY.

Follow-up ✔ Evidence checked on 2026-10-25:

- No non-local requests while Monaco is open: `e2e/items-edit.spec.ts` > "edits an item locally and undoes it". The test records every request hostname and expects that list to be empty once `.monaco-editor` is visible. Hosts other than `127.0.0.1` and `localhost` fail the test.
- Conditional Undo of an edit: `apps/web/src/features/items/use-item-mutations.test.tsx` > "opens a conflict when undo finds the saved version is gone". Undo posts `items/update` with `expectedHash` `saved-hash`. A 409 `CONDITION_FAILED` sets `conflict.expectedHash` to `saved-hash`. Undo of a delete still uses `ifNotExists` (`delete-confirm.test.ts`).
- Server rejects key changes: `apps/server/src/routes/items.int.test.ts` > "creates, conflicts, rejects a changed key, and blocks an oversized item". `POST items/update` with a different `id` returns 400 `VALIDATION` and does not write the new key.
- Bulk-delete contract: `specs/04-api-contract.md` `POST items/batch-delete` accepts at most 500 keys, drops duplicates, splits the rest into chunks of 25, retries `UnprocessedItems` with exponential backoff and full jitter (base 50 ms, cap 2 s, about 8 attempts), and stops when the request is aborted. The client sends its own chunks of 25. Cancel skips chunks that have not started.
- Textarea fallback save: `e2e/items-edit.spec.ts` > "saves through the textarea fallback without changing types". Aborting a URL that contains `monaco` or `JsonEditor` shows "The code editor could not be loaded. You can still edit the JSON here." The stored item keeps `email` as `S`, `tags` as `SS` `["a","b"]`, and `n` as `N` `100` (DynamoDB stored the written `1E+2` as `100`).
- AC-5.6: `e2e/items-edit.spec.ts` > "deletes 120 created items from the grid" (Chromium, 2026-10-25) creates 120 `edge-cases` items, confirms "Delete 120 items?", and expects "Deleted 120, 0 failed". `apps/server/src/dynamo/batch-delete.test.ts` > "retries unprocessed keys across 120 items" injects `UnprocessedItems` for every batch larger than one. The sends are `[25, 1, 25, 1, 25, 1, 25, 1, 20, 1]`, `deleted` is 120, and `failed` is empty. DynamoDB Local does not return `UnprocessedItems`, so that injection is the unit stub. The 30-key dedupe test remains `[25, 1, 5, 1]`.

Follow-up ✔ Monaco gzip from `pnpm --filter @dynamo-studio/web build` on 2026-10-25, using the same `gzipSync` as `scripts/check-bundle.ts`. `JsonEditor-DomD6-ko.js` is 327038 bytes. `editor.api-DcidzL7_.js` is 698489 bytes. `json.worker-BfeARH1Q.js` is 127909 bytes. `editor.worker-CX7Cj20z.js` is 92399 bytes. Vite printed 331.81 kB and 706.08 kB for the first two. Initial JavaScript gzip is 181129 bytes, and the entry does not import Monaco.

The production server (`NODE_ENV=production`) listened on http://127.0.0.1:8080 and served that `apps/web/dist`. Chromium connected to DynamoDB Local, opened `empty-string`, and Edit showed the Monaco editor with `"id": "empty-string"`. The four scripts above, plus `JsonEditor-CLfMljIC.css`, loaded from `127.0.0.1:8080`. No other host was requested.

The first production load threw `Illegal value for token color: #fff` because the minified stylesheet shortens `#ffffff` to `#fff`. `monacoColor` expands that to `#ffffff` before `defineTheme`. `apps/web/src/features/items/monaco-color.test.ts`.

## Acceptance criteria evidence

- AC-0.1 ✔ `pnpm verify` on 2026-10-23 with DynamoDB Local up: lint, typecheck, 14 unit tests, 2 integration tests, production build. Web JavaScript gzip 100585 bytes (budget 256000).
- AC-0.2 ✔ Phase 0 screenshots remain at `docs/screenshots/phase-0/placeholder-light.png` and `docs/screenshots/phase-0/placeholder-dark.png`. The smoke test is now `e2e/smoke.spec.ts` > "connect screen shows DynamoDB Studio". It still fails on serious or critical axe violations and does not overwrite the phase-0 images.
- AC-0.3 ✔ `scripts/seed.int.test.ts` > "creates users(1000), orders(10000), sessions, and edge-cases". `pnpm seed` completed in 1502ms.
- AC-0.4 ✔ `apps/server/src/routes/health.ts` and `apps/web/src/app/fetch-health.ts` import `@dynamo-studio/shared`. `apps/web/src/app/fetch-health.test.ts` parses a health payload. The connect screen does not render the health sentence.
- AC-0.5 ✔ `.husky/commit-msg` rejects `bad message` (exit 1) and accepts `chore: test` (exit 0).
- AC-0.6 ◻ `actionlint` is not on PATH, so the workflow was not linted. Command left: `actionlint .github/workflows/ci.yml`. The workflow is `.github/workflows/ci.yml` with jobs `verify`, `integration`, `e2e`, and `build`.
- AC-0.7 ✔ `pnpm lint` is green. `eslint.config.js` sets `@typescript-eslint/no-explicit-any` and `no-console` to error.
- AC-1.1 ✔ `e2e/shell.spec.ts` writes light and dark screenshots: `docs/screenshots/phase-1/shell-*.png`, `shell-drawer-*.png`, `shell-rail-*.png`, `shell-1024-*.png`, and `gallery-*.png`.
- AC-1.2 ✔ `apps/web/src/lib/contrast.test.ts` > "token contrast". Pairs include warning-text on bg and surface, text-disabled on bg and surface, text-primary on the dark error/success/warning containers, and primary on bg, surface, surface-variant, and primary-container.
- AC-1.3 ✔ `e2e/shell.spec.ts` > "does not flash a light theme when dark is stored" (CPU throttle 8, `prefers-color-scheme: light`, stored `mui-mode` dark). Every observed `data-color-scheme` write was `dark`. Body background was `rgb(32, 33, 36)`.
- AC-1.4 ✔ `apps/web/src/lib/source-rules.test.ts` > "does not use !important in the web app". `e2e/shell.spec.ts` gallery test expects the layer-probe card `border-radius` to be `0px`.
- AC-1.5 ✔ `e2e/shell.spec.ts` > "keyboard can use the palette, sidebar, drawer, and shortcuts".
- AC-1.6 ✔ The same shell and gallery tests fail on serious or critical axe violations in light and dark.
- AC-1.7 ✔ Recorded miss. `pnpm build` on 2026-10-23: `Web JavaScript gzip: 201611 bytes` (150 KB is 153600). AC-1.7 in the phase file records 201611 bytes. The 250 KB script budget still passes.
- AC-1.8 ✔ `apps/web/src/lib/motion.test.ts` > motion helper returns opacity-only transitions when reduced motion is set.
- AC-2.1 ✔ `e2e/connect.spec.ts` > "reaches the workspace from a pasted URL with Enter". The endpoint is focused; typing `localhost:8000` and pressing Enter opens the workspace.
- AC-2.2 ✔ `e2e/connect.spec.ts` > "retries a wrong URL without reloading". Copy: `Couldn't reach http://127.0.0.1:9. Is DynamoDB running and the URL correct?`
- AC-2.3 ✔ `apps/server/src/routes/connections.int.test.ts` covers local, keys, profile, and default-chain auth against DynamoDB Local.
- AC-2.4 ✔ `apps/server/src/routes/read-only.test.ts` > read-only probe is 403, then 204 after PATCH. `enableProbe: false` is 404.
- AC-2.5 ✔ Profile list and connection responses are scanned for `secretAccessKey` and `sessionToken`. `apps/server/src/routes/connections.test.ts` captures logs during a keyed connect and asserts `secretAccessKey`, `sessionToken`, and `Authorization` are absent.
- AC-2.6 ✔ `apps/server/src/store/profile-store.test.ts` checks mode `0600`, directory `0700`, and a unique IV.
- AC-2.7 ✔ `apps/server/src/plugins/security.test.ts` covers CSRF, Origin, Host rebinding, and idle expiry.
- AC-2.8 ✔ `e2e/connect.spec.ts` > "shows connection lost when the endpoint proxy closes". The chip shows latency, then the banner appears within 35s. Docker stays up.
- AC-2.9 ✔ `e2e/connect.spec.ts` connect-screen axe tests in light and dark, plus "can complete the connect form from the keyboard". Screenshots: `docs/screenshots/phase-2/connect-*.png` and `workspace-*.png`.
- AC-2.10 ✔ Security checklist below. PartiQL, import, and expression-interpolation rows are waived until those routes exist.
- AC-3.1 ✔ `e2e/tables.spec.ts` > "searches seed tables and opens orders from the keyboard". Typing `ord` leaves `orders`; Enter opens it.
- AC-3.2 ✔ `apps/web/src/features/workspace/SidebarTableList.test.tsx` > "keeps a thousand names virtualized until the search narrows them". `apps/server/src/dynamo/list-tables.test.ts` walks a mocked list. `apps/server/src/routes/tables.int.test.ts` creates 101 `p3t-*` tables and follows the cursor. `e2e/tables.spec.ts` > "scrolls, searches, and keyboard-navigates a few hundred tables" uses 300 `p3e-*` tables.
- AC-3.3 ✔ `e2e/tables.spec.ts` overview of `orders` shows `userId`, `createdAt`, and `status-createdAt-index`. `apps/server/src/routes/tables.int.test.ts` asserts the same keys and GSI. `apps/web/src/features/tables/TableOverview.test.tsx` > "shows orders keys, the GSI, and an approximate count".
- AC-3.4 ✔ `e2e/tables.spec.ts` deep link shows `Enabled on expiresAt` for `sessions`. The overview component test covers the same TTL line.
- AC-3.5 ✔ `apps/web/src/features/tables/use-table.poll.test.tsx` > "polls every 3 seconds while creating and stops once the table is active" and "does not poll an archived table". Fake timers. The UI does not call `POST .../wait`.
- AC-3.6 ✔ `e2e/tables.spec.ts` > "deep-links overview, sessions TTL, a dotted name, and a missing table". `/c/:id/t/orders/overview` renders after navigation. `missing-table` shows "That table doesn't exist (anymore)." and "Back to tables". `my.table-v2` is also covered by `TableOverview.test.tsx` > "round-trips a dotted table name through the URL, sidebar, and overview".
- AC-3.7 ✔ The seed keyboard test searches, opens, switches to Overview and Indexes, and closes back to "Pick a table to get started". `e2e/tables.spec.ts` axe tests in light and dark fail on serious or critical violations. Screenshots: `docs/screenshots/phase-3/sidebar-*.png` and `overview-*.png`.
- AC-3.8 ✔ The count reads "About 10,000 items, …" and the hint button says "Approximate. DynamoDB updates this count periodically." The overview test asserts the word "exact" is absent. The same hint is hovered in the seed Playwright test.
- AC-4.1 ✔ `e2e/items.spec.ts` > "scrolls 10000 loaded order rows at 4x cpu". 60.2 fps on 2026-10-24. Machine Apple M5, Darwin. Browser Chromium (Playwright). CPU throttle 4x. Method: `requestAnimationFrame` for 2 seconds, adding 96px to the items grid `scrollTop`, after 10,000 `orders` rows were loaded. The page was the Vite dev server at `http://127.0.0.1:5173`. The same assertion passed again in the full Playwright run.
- AC-4.2 ✔ `apps/web/src/features/items/cell-text.test.ts` > "distinguishes missing, null, and empty string" and "renders every other DynamoDB type". `e2e/items.spec.ts` > "browses orders, filters status, and opens an item from the keyboard" expects exact cells "Empty string", "Null", and "Missing" on `edge-cases`.
- AC-4.3 ✔ `apps/server/src/routes/scan.int.test.ts` > "filters orders and edge-cases, pages, and projects" filters `status = SHIPPED` and rejects other statuses. The same Playwright test shows the filter tip and no PENDING cells. `apps/server/src/dynamo/scan.test.ts` > "keeps a 38-digit filter value as a string and aliases reserved words".
- AC-4.4 ✔ The same integration test scans `address.city = "Pune"`. `scripts/seed.int.test.ts` > "creates users(1000), orders(10000), sessions, and edge-cases" asserts that item.
- AC-4.5 ✔ `apps/web/src/features/items/use-scan-items.test.tsx` > "aborts the previous scan when the page size changes". `apps/server/src/routes/scan.int.test.ts` > "stops DynamoDB calls when the scan request is aborted". `apps/server/src/dynamo/scan.test.ts` > "does not call DynamoDB again after the caller aborts".
- AC-4.6 ✔ `apps/web/src/features/items/columns.test.ts` > "keys storage by a hash and ignores secrets". `apps/web/src/features/items/ItemsPanel.test.tsx` > "keeps hidden columns for one table". Widths resize in `DataGrid.test.tsx` > "resizes from the keyboard, selects a range, and opens on enter".
- AC-4.7 ✔ That DataGrid test shift-selects three rows and then selects all five loaded rows. `ItemsPanel.test.tsx` > "keeps the selected count after another page loads" stays at "1 selected" when the next page arrives, and row 2 stays unchecked.
- AC-4.8 ✔ `e2e/items.spec.ts` finds `12345678901234567890123456789012345678` on `edge-cases`. `DataGrid.test.tsx` > "virtualizes a thousand rows and keeps a 38-digit number exact". `filter-ops.test.ts` > "keeps a 38-digit number as a decimal string". `ItemsPanel.test.tsx` > "caps 500 columns and sends a 38-digit number as a string" asserts the POST body.
- AC-4.9 ✔ The items Playwright test focuses a body cell, presses Enter, sees `"S": "SHIPPED"` in Item details, and Escape closes it. `e2e/items.spec.ts` > "items screenshots and axe in light" and "items screenshots and axe in dark" have 0 serious or critical violations, then zoom the page to 200% at 1280×800 and still show Add filter and the grid. Screenshots: `docs/screenshots/phase-4/items-light.png` and `items-dark.png`. Names are noted in `docs/a11y-notes.md`.
- AC-4.10 ✔ `apps/server/src/dynamo/expression-builder.test.ts` > "keeps user text out of expression strings". Branch coverage of `expression-builder.ts` was 100% (99/99) on 2026-10-24. The property test strips operator words before it looks for attribute names, so a path named `type` is not treated as a leak inside `attribute_type`.
- AC-5.1 ✔ `packages/shared/src/typed-json.test.ts` > the 1,000-run property. Save stays disabled until the JSON changes, so a no-edit save does not write. The browser tests compare the stored item after a real edit and after undo.
- AC-5.2 ✔ `e2e/items-edit.spec.ts` > "edits an item locally and undoes it". The item is created on `edge-cases` with an email, not a seed `users` row. `apps/server/src/routes/items.int.test.ts` writes a real user. Conditional Undo is `use-item-mutations.test.tsx` > "opens a conflict when undo finds the saved version is gone": the update sends `expectedHash` `saved-hash`, and 409 `CONDITION_FAILED` opens the conflict dialog.
- AC-5.3 ✔ `apps/web/src/features/items/editor-text.test.ts` and `packages/shared/src/item-check.test.ts` > "The key id cannot change". `items.int.test.ts` posts `items/update` with a different `id` and expects 400 `VALIDATION`.
- AC-5.4 ✔ `e2e/items-edit.spec.ts` > "shows a conflict when another session changes the item". Reload shows the other session's email. Overwrite stores `mine-again@example.com` and returns to view mode. `ConflictDialog.test.tsx` clicks Overwrite.
- AC-5.5 ✔ The same browser file > "explains a create collision and confirms a production delete". The integration test asserts the same collision message.
- AC-5.6 ✔ `e2e/items-edit.spec.ts` > "deletes 120 created items from the grid" (Chromium, 2026-10-25). The dialog is "Delete 120 items?" and the snackbar is "Deleted 120, 0 failed". `batch-delete.test.ts` > "retries unprocessed keys across 120 items" injects `UnprocessedItems` and expects sends `[25, 1, 25, 1, 25, 1, 25, 1, 20, 1]` with 120 deleted and none failed. DynamoDB Local does not return `UnprocessedItems`. The 30-key dedupe case stays. `specs/04-api-contract.md` records the 500-key limit, chunks of 25, and the retry. `items.int.test.ts` still deletes 3 users on the real route.
- AC-5.7 ✔ The collision browser test connects with `env: "production"` against local DynamoDB and must type `edge-cases` before Delete.
- AC-5.8 ✔ `e2e/items-edit.spec.ts` > "disables writes on a read-only connection" (Chromium, 2026-10-25). Create uses the title "This connection is read-only". After a row is selected, Delete is disabled with that tooltip. Opening `number-38` disables Edit, Duplicate, and Delete with the same tooltip. `PUT /api/v1/connections/:id/tables/edge-cases/items` returns 403 READ_ONLY. `items.int.test.ts` covers the same 403.
- AC-5.9 ✔ The browser file > "saves a 390 KB item and blocks one over 400 KB". The client message is "This item is over 400 KB. DynamoDB allows 400 KB." `items.int.test.ts` returns LIMIT_EXCEEDED for a 401 KB item.
- AC-5.10 ✔ `scripts/check-bundle.ts` rejects `monaco-editor` and `MonacoEnvironment` in the entry script. The 2026-10-25 production build measured initial JavaScript gzip at 181129 bytes. Lazy Monaco gzip is 327038 bytes (`JsonEditor-DomD6-ko.js`) and 698489 bytes (`editor.api-DcidzL7_.js`). Chromium loaded both, plus the JSON and editor workers, from the production server on port 8080, and the editor showed the `empty-string` item. `e2e/items-edit.spec.ts` > "edits an item locally and undoes it" expects no request host other than `127.0.0.1` or `localhost` while `.monaco-editor` is visible. The same file > "saves through the textarea fallback without changing types" aborts `monaco` and `JsonEditor` URLs, saves from the textarea, and checks stored `email` `S`, `tags` `SS` `["a","b"]`, and `n` `N` `100`.
- AC-5.11 ✔ `apps/web/src/features/items/copy-command.test.ts`.
- AC-5.12 ✔ The browser file > "opens a large item and checks the drawer for serious accessibility issues" in light and dark, then Escape focuses the `large` cell. Zoom is 200% at 1280×800 and Edit stays visible. `docs/a11y-notes.md` records the drawer names. This was the accessibility tree, not a live screen reader. Screenshots: `docs/screenshots/phase-5/item-drawer-light.png` and `item-drawer-dark.png`.
- AC-6.1 ✔ `apps/server/src/routes/query.int.test.ts`. Descending `userId = user-0001` with `createdAt BETWEEN` returns those orders.
- AC-6.2 ✔ The same integration test queries `status-createdAt-index` with `begins_with` and returns `SHIPPED` items. Consistent read on that GSI is `400 VALIDATION` before Query. `QueryBuilder.test.tsx` and `e2e/query.spec.ts` disable the control and show the tooltip. The seed has no LSI, so consistent read on a local index was not exercised.
- AC-6.3 ✔ `QueryBuilder.test.tsx` shows the server preview JSON. `ItemsPanel.test.tsx` > "runs a query in the same grid and clears filters unless asked" shows `#n0 = :v0`. `e2e/query.spec.ts` expects `BETWEEN` on the JSON tab and an AWS CLI command without credentials.
- AC-6.4 ✔ `query.int.test.ts` filters `name` and `timestamp`. The names map contains `userId`, `name`, and `timestamp`. `packages/shared/src/query-request.test.ts` aliases `status`, `name`, and `timestamp` in the key condition.
- AC-6.5 ✔ `packages/shared/src/partiql.test.ts`. `select`, `SELECT`, leading whitespace, `-- DELETE`, a block comment, and `'DELETE'` are selects. `UPDATE`, `INSERT`, `DELETE`, empty input, `SELEC`, two statements separated by `;`, an unclosed string, and an unclosed comment are mutations.
- AC-6.6 ✔ `apps/server/src/routes/partiql.int.test.ts`. A read-only `UPDATE` is `403 READ_ONLY`. A writable `UPDATE` without `X-DS-Confirm: mutation` is `400 VALIDATION`. A `DELETE` sent with `X-DS-Confirm: select` is `400 VALIDATION` and the item stays. The same delete with `mutation` returns 200.
- AC-6.7 ✔ `apps/web/src/features/partiql/partiql-storage.test.ts` and `PartiqlPanel.test.tsx`. History keeps 100 statements and drops a consecutive duplicate. The key matches `ds-partiql-history:` plus 64 hex characters and does not contain the endpoint. Clear history removes that key and `ds-partiql-saved:`. The stored JSON has no secret, access key, or session token.
- AC-6.8 ✔ `apps/web/src/features/partiql/PartiqlCodeEditor.test.tsx` sets a Monaco marker at line 2, column 4. `partiql.int.test.ts` expects `details.position` to be absent for `SELECT * FROM "users" WHERE` on DynamoDB Local. AWS was not checked.
- AC-6.9 ✔ `apps/server/src/dynamo/partiql.test.ts` > "stops the page loop when the request is aborted". Aborting the request ends the page loop after one `ExecuteStatement` call. `apps/web/src/features/partiql/PartiqlPanel.test.tsx` > "stops a running statement and returns to idle" clicks Stop, expects that request's abort signal to fire, and expects Stop to be disabled again with "Run a statement to see items."
- AC-6.10 ✔ `e2e/query.spec.ts`. axe reports 0 serious or critical violations on the query view and the PartiQL view in light and dark. `Control+Enter` runs the query. At 200% zoom and 1280×800, Run query stays visible. Screenshots: `docs/screenshots/phase-6/query-light.png`, `query-dark.png`, `partiql-light.png`, `partiql-dark.png`. `docs/a11y-notes.md` records the names. This was the accessibility tree, not a live screen reader.

## Security checklist (05 section 8, Phase 2)

- [x] Secrets never in responses, logs, URLs, localStorage, or error messages. Log redaction test and response scans above. The browser keeps credentials in the request body only; profiles on disk are ciphertext.
- [x] Cookie `ds_session` is httpOnly and SameSite=Strict. Mutations require `x-ds-csrf`. `apps/server/src/plugins/security.test.ts`.
- [x] Origin and Host checks reject a foreign origin and a rebinding Host. The server binds `127.0.0.1` unless configured otherwise.
- [x] Read-only is enforced by `assertWritable` on the server. The test probe returns `403 READ_ONLY`. PartiQL mutations call `assertWritable` before the confirm header is checked (`partiql.int.test.ts`: a read-only `UPDATE` is `403 READ_ONLY`; a missing `X-DS-Confirm: mutation` is `400 VALIDATION`). Import and clear routes do not exist yet. New mutating routes must use the same guard.
- [x] Request bodies use Zod strict objects. The JSON body limit is 2MB (`413` → `LIMIT_EXCEEDED`). The 30/minute limit applies to `POST /connections/test`, `POST /connections`, and `POST /profiles/:id/connect`. Heartbeat is not limited.
- [x] Query key conditions, filters, and projections use `#n` / `:v` placeholders (`expression-builder.test.ts`, `query.int.test.ts`). PartiQL parameters are bound values. The server classifies the statement itself and ignores a client-sent kind. Phase 2 waived this row because those routes did not exist yet.
- [x] SSRF: the endpoint is user-chosen on a local server. Only `http:` and `https:` are accepted. `hostBindingWarning` logs when the bind host is not loopback.
- [x] Profile file and key file are mode `0600`, directory `0700`. The key stays on disk. Threat model: one local user. Encryption stops a casual copy of `profiles.json` from revealing secrets; someone who can read both the key and the file can decrypt.
- [x] `pnpm audit` result is recorded in the Phase 2 summary. The lockfile is committed.

## Pinned versions (registry check 2026-10-23, before install)

Installed, matching the registry latest unless noted:

- typescript 6.0.3. Registry latest was 7.0.2. `typescript-eslint@8.72.0` accepts `typescript` `>=4.8.4 <6.1.0`, so 6.0.3 is the newest compatible release.
- eslint 9.39.5. Registry latest was 10.13.0. `eslint-plugin-jsx-a11y@6.10.2` accepts ESLint through 9 only. pnpm notes that 9.39.5 is deprecated because 10 exists. The peer set is consistent.
- zod 4.6.7, fastify 5.12.7, pino 10.4.0, pino-pretty 13.2.0 (installed, not wired into the dev script yet)
- react 19.3.1, react-dom 19.3.1, @tanstack/react-query 5.104.5, vite 8.3.5, @vitejs/plugin-react 6.1.2
- vitest 5.0.5, jsdom 30.1.3, msw 3.0.3
- @testing-library/react 16.3.3, @testing-library/user-event 14.6.8, @testing-library/jest-dom 7.0.1
- @types/node 26.6.5, @types/react 19.3.0, @types/react-dom 19.3.0
- @aws-sdk/client-dynamodb 3.1156.0, @playwright/test 1.64.1, @axe-core/playwright 4.14.0
- typescript-eslint 8.72.0, prettier 3.9.10, husky 9.1.7, lint-staged 17.6.0, tsx 4.23.15
- eslint-plugin-react-hooks 7.1.1, eslint-plugin-jsx-a11y 6.10.2

Phase 1 installed, from `pnpm list` on 2026-10-23:

- @mui/material 9.5.0, @mui/icons-material 9.5.0 (registry had moved past the planning note of 9.4.0)
- @emotion/react 11.14.0, @emotion/styled 11.14.1
- tailwindcss 4.3.3, @tailwindcss/vite 4.3.3
- zustand 5.0.16, react-router-dom 7.18.4
- @fontsource/roboto 5.3.0, @fontsource/roboto-mono 5.3.0

Phase 2 added on the web app: react-hook-form 7.90.0, @hookform/resolvers 6.0.0, zod 4.6.7 (already used by shared). Server dependencies from earlier in the phase: @fastify/cookie 11.1.3, @fastify/static 10.1.7, @fastify/rate-limit 11.2.1, @aws-sdk/credential-providers 3.1155.0.

Monaco stays out until Phase 5. Phase 5 added `lossless-json` 4.3.3 to `@dynamo-studio/shared` and `fast-check` 4.10.2 as a dev dependency there.

`exactOptionalPropertyTypes` stayed on. `pnpm dev` is `scripts/dev.ts`, not `concurrently`.

## Decisions & spec changes

- 2026-10-23 — Planning decisions applied. Roadmap saved as `specs/master-plan.md` and added to the AGENTS.md read order. Phase 0 has not started. Exact dependency versions are recorded here during Phase 0, after a registry check, before install.
  - Query is a Scan | Query control on the Items tab. Tabs are Items, PartiQL, Overview, Indexes.
  - One filter joiner (`and` or `or`) for the whole list. A per-filter joiner is `400 VALIDATION`.
  - Snackbars last 4 seconds. When Undo is available they stay until Undo, dismiss, or 30 seconds.
  - Item `expectedHash` stays best-effort (DynamoDB skill section 5). The conflict UI says so.
  - `GET /connections/:id` returns `{ summary, latencyMs }` from `ListTables` with limit 1. No `accountId`. No STS.
  - Rate limit is 30 requests per minute per session, only on `POST /connections/test`, `POST /connections`, and `POST /profiles/:id/connect`. The heartbeat is not limited.
  - A PartiQL mutation without `X-DS-Confirm: mutation` is `400 VALIDATION`. Read-only remains `403 READ_ONLY`.
  - Pagination cursors are opaque. `fillPage` stops at 2 seconds or 10 calls, whichever comes first.
  - Plain JSON `$` key escaping adds one leading `$` on output and strips one on input. Numbers go through `lossless-json`.
  - A blank endpoint rejects local auth and defaults to the default credential chain. Every tab shares one session cookie.
  - Seed `edge-cases` includes `address.city = "Pune"` and a 38-digit number.
  - `pnpm verify` expects DynamoDB Local to be running.
  - The Items screen scans the base table. Scan `index` stays on the API for tests.
- 2026-10-24 — Phase 4 UI. TanStack Table on the web is 9.3.1 (`useTable`, `tableFeatures`, `sortFn`). `@tanstack/react-virtual` is ^3.14.22. Both were already named in the stack. The grid lives in the lazy Workspace chunk.
- A filter attribute named `type` is a substring of `attribute_type`. The expression property test removes operator words before it searches for attribute names. The builder still emits only `#n` and `:v` placeholders.
  - Import error reports live 1 hour and are deleted on shutdown.
  - Palette and snackbars use MUI. The product path does not add `lib-dynamodb`, `cmdk`, or `notistack`.
  - License is MIT. Phase 8 versioning is `CHANGELOG.md` plus a semver script.
  - Dark container, `text-disabled`, and `warning-text` hex values are chosen in Phase 1 by the contrast test, then written into `03-design-system.md`. `#F9AB00` is a fill and the Staging dot.
  - MUI color scheme selector is `[data-color-scheme="%s"]`, set by an inline script before React mounts.
  - Planning observed `@mui/material` 9.4.0 and `tailwindcss` 4.3 on 2026-10-23. Phase 1 installed 9.5.0 and 4.3.3.
- 2026-10-23 — Phase 1 contrast and shell defaults.
  - Light `primary` is `#1967D2`. `#1A73E8` is 4.27:1 on `bg` and 3.93:1 on `primary-container`, so text buttons, tabs, and the selected row failed axe. The Dev dot stays `#1A73E8`.
  - Light `text-disabled` is `#727272`. Dark containers are `#5C2B29`, `#16352A`, and `#3E2E00`. Dark `warning-text` is `#F6C343`.
  - Density is Comfortable (48px) or Compact (32px) in the overflow menu and sets `--row-height`.
  - `/__design` is registered only when `import.meta.env.DEV` is true. `scripts/check-design-bundle.ts` fails the production build if `/__design`, `Design gallery`, or `DesignGallery` appears in `apps/web/dist`.
- 2026-10-23 — Bundle hygiene before Phase 3. This is not a phase.
  - `react-router@7.18.4` publishes an export map that points every condition at `dist/development` and has no `production` condition. `vite build` already sets `NODE_ENV=production` and Vite's resolve conditions to `production`, which cannot select a condition the package does not offer. Production builds alias `react-router` and `react-router/dom` to `dist/production`.
  - Connect, workspace, and dev-only `/__design` are separate chunks. `scripts/check-bundle.ts` (230 KB) and `scripts/check-bundle-size.ts` (250 KB) both measure the entry script linked from `index.html`. Lazy chunks are not part of that number.

## Constitution changes
(none)

## Phase summaries

### Phase 0 — Foundation (2026-10-23)

Shipped a pnpm workspace (`apps/web`, `apps/server`, `packages/shared`) where `pnpm dev` shows an unthemed placeholder that reads `GET /api/v1/health` through the Vite proxy. `HealthResponse` is the only shared Zod schema. DynamoDB Local runs `-sharedDb -inMemory` on port 8000. `pnpm dev:db` starts it and `pnpm seed` loads users (1000), orders (10000), sessions, and edge-cases, including `address.city = "Pune"` and a 38-digit number. `pnpm verify` is green with Docker running. The placeholder has no MUI theme, so the dark screenshot is the same page under `prefers-color-scheme: dark`. `actionlint` was not installed, so CI workflow lint is still open. Q-001 through Q-005 stay open with the defaults used here.

### Phase 1 — Design system and app shell (2026-10-23)

The shell is MUI 9 plus Tailwind 4, with light, dark, and system themes. An inline script sets `data-color-scheme` from `mui-mode` before React, and a throttled Playwright reload never observed a light scheme when dark was stored. The workspace is mock data: app bar, filterable sidebar that collapses to a 72px rail, URL tabs, and a focus-trapped drawer that resizes from 420 to 720. Comfortable and Compact live in the overflow menu and set `--row-height` to 48px or 32px. `/` is a wordmark, theme toggle, and Connect button. `/__design` exists only in dev; the production build rejects the gallery string and measured 201611 bytes of JavaScript gzip, which is over the 150 KB attempt and under the 250 KB Phase 8 budget. Q-006, Q-007, Q-008, and Q-010 stay open on the defaults used here. Q-009 is resolved by the recorded bundle size. Next command, when you want it, is `/phase 2`.

### Phase 2 — Backend and connection (2026-10-23)

Pasting `localhost:8000` and pressing Enter opens a real workspace. Credentials stay in server memory. Remembered profiles are AES-256-GCM on disk (`0600`, unique IV). The session cookie is httpOnly and SameSite=Strict, mutations need `x-ds-csrf`, and a bad Origin or Host is rejected. Read-only is enforced on the server; the test probe exists only when `NODE_ENV=test` or `buildApp({ enableProbe: true })`. Idle sessions expire after 8 hours, a session holds at most 10 connections, and `client.destroy()` runs on delete, disconnect, and expiry. The app bar chip shows name, region, and latency. Heartbeat is every 30 seconds and pauses while the tab is hidden. Closing a TCP proxy in front of DynamoDB Local shows "Connection lost. Retry / Disconnect" within 35 seconds. The live sidebar has no mock tables. `pnpm verify` is green (116 unit tests, 3 integration tests). `pnpm audit` reports no known vulnerabilities. Q-007 is resolved. Q-011 through Q-019 stay open on the defaults used here. Do not start Phase 3 until asked.

Before the connect UI was added, the production chunk was 201648 bytes gzip. Proportional contributors: react-dom about 32% (~65 KB), MUI about 30% (~60 KB), the react-router development build about 14% (~29 KB), MUI System about 5%, TanStack Query about 4%, Popper about 3%. App code was tiny. After `react-hook-form`, `@hookform/resolvers`, and direct `zod` on the web app, `pnpm verify` measured 255080 bytes gzip (`index-2vbAiA2f.js`, budget 256000). About 920 bytes of headroom remain. The react-router development build was left in place because the budget still passed.

### Phase 3 — Table explorer (2026-10-24)

After connect, the sidebar loads table names a page at a time, filters what is already loaded, and asks the server only while another page remains. Lists over 200 names are virtualized. Enter opens the first match, arrows move the highlight, and Escape clears the filter. Open tables remember their last section, stop at 20, and middle-click closes one. Overview shows keys, capacity, TTL, streams, and indexes, and the item count is labeled approximate. Creating, updating, and deleting tables poll every 3 seconds; archived and inaccessible tables do not. A missing table explains itself and offers a way back. `pnpm verify` is green (154 unit tests, 4 integration tests). `pnpm exec playwright test --workers=1` passed 18 tests. Initial JS gzip is 180217 bytes, up from 179897 at the start of the phase. Q-020 through Q-024 stay on the defaults used here. Do not start Phase 4 until asked.

### Phase 4 — Items browser (2026-10-24)

The Items tab scans the open table into a virtualized grid. Cells show a type letter and keep numbers as decimal strings, including a 38-digit value. Missing, null, and empty string stay distinct. Filters are type-aware, one joiner covers the list, and a number filter is still a string in the POST body. The first 200 columns show until "Show more columns". Visibility and widths persist under `ds-columns:` plus a hash of endpoint, region, and table. Delete and Copy stay disabled. Opening a cell shows typed JSON in the existing drawer. Query mode is the placeholder "Query builder arrives in the next step". `pnpm verify` is green (215 unit tests, 6 integration tests). `pnpm exec playwright test --workers=1` passed 22 tests. Initial JS gzip is 180241 bytes, up from 180217. Scrolling 10,000 loaded orders rows measured 60.2 fps at 4x CPU on an Apple M5 in Chromium. Q-025 through Q-029 stay on the defaults used here. Do not start Phase 5 until asked.

### Phase 5 — Item editor and CRUD (2026-10-25)

Opening an item shows plain JSON. Edit, create, and duplicate load Monaco from the local package, not a CDN. Save replaces the item and sends the hash from when it was opened. A second session opens the conflict dialog; Reload keeps the latest item and Overwrite writes yours, then returns to view mode. Undo of an edit writes the previous item only when the saved hash still matches. Create, duplicate, single delete, and a 100-item delete are confirmed, and a production-tagged connection types the table name. A 390 KB item saves. Past 400 KB, Save stays disabled. Read-only disables the write buttons, and the server still returns 403. EDT-7 is in the backlog. `pnpm verify` is green (244 unit tests, 7 integration tests). `pnpm exec playwright test --workers=1` passed 29 tests. Initial JS gzip is 181131 bytes, up from 180241. Monaco's editor chunk is separate. Q-030 through Q-034 stay on the defaults used here. Q-029 stays open. Do not start Phase 6 until asked.

Not verified: `rm -rf node_modules && pnpm install --frozen-lockfile`. `pnpm dev` was using `node_modules`, so that install was not wiped. A live screen reader was not used. The browser bulk delete was 100 items, not 120. DynamoDB Local did not produce unprocessed items.

### Phase 6 — Query builder and PartiQL (2026-10-26)

The Items tab switches between Scan and Query. Query needs a partition key, builds the key condition with placeholders, and shows the result in the same grid. Show request prints the server preview and an AWS CLI command without credentials. Consistent read stays available on the base table and is disabled on a GSI. PartiQL is its own lazy tab. The server classifies the statement and ignores any client-sent kind. A mutation needs `X-DS-Confirm: mutation`, and a read-only connection is still 403. History and saved queries stay in localStorage under a hash of the endpoint and region. Clear history removes both. DynamoDB Local returns no syntax-error position, so the marker evidence is the component test. AWS was not checked. The seed has no LSI. `pnpm verify` is green (295 unit tests, 10 integration tests). `pnpm exec playwright test --workers=1` passed 33 tests. Initial JS gzip is 181399 bytes, up from 181129. PartiQL and Monaco stay out of the entry. Q-035 through Q-039 stay on the defaults used here. Do not start Phase 7 until asked.

Not verified: `rm -rf node_modules && pnpm install --frozen-lockfile`. A live screen reader was not used. `actionlint` is not on PATH (`actionlint .github/workflows/ci.yml`). AWS was not checked for PartiQL error positions. The seed has no LSI, so consistent read on a local index was not exercised.

Follow-up ✔ Integration and browser tests that write use a unique item or table name and delete it in `finally` (`apps/server/src/local-cleanup.ts`). The 390 KB edit uses its own item. The table list no longer expects a fixed global count. `pnpm test:int` passed twice. A reverse-file run passed with `scripts/seed.int.test.ts` first and the seed counts exact. `pnpm exec playwright test --workers=1` passed twice (33 tests). The same files then ran one at a time from `tables.spec.ts` back to `connect.spec.ts`, and the seed test still expected 1000 users, 10000 orders, and 10 edge-cases.

Follow-up ✔ The classifier fails closed in `packages/shared/src/partiql.test.ts`: `""` is `empty`, `SELEC * FROM t` is `typo`, and `SELECT * FROM t; SELECT * FROM t` is `two statements`, all mutations. PartiQL `NextToken` cursors hash the statement, parameters, and consistent read. A mismatch is `400 VALIDATION` in `apps/server/src/dynamo/partiql.test.ts` (statement, parameters, or consistent read) and in `partiql.int.test.ts` (a page cursor reused with a different statement). The Phase 5 follow-up remains `items.int.test.ts` > "round-trips every edge-cases item through plain JSON and the update route" and `e2e/items-edit.spec.ts` > "disables writes on a read-only connection".

## Metrics log

- 2026-10-23 — Phase 0 web JavaScript gzip: 100585 bytes. Budget 256000.
- 2026-10-23 — Phase 1 web JavaScript gzip: 201611 bytes (one chunk, `apps/web/dist/assets/index-*.js`). Attempted budget 153600. Phase 8 budget 256000. CSS gzip 21.19 KB is not in the JS number. Machine: local Darwin, Node 26.4.0. No 10k-row fps or API overhead yet.
- 2026-10-23 — Phase 2, before connect UI: 201648 bytes gzip. After connect UI: 255080 bytes gzip (`apps/web/dist/assets/index-2vbAiA2f.js`). Budget 256000. CSS gzip 21.32 KB. `pnpm audit`: no known vulnerabilities.
- 2026-10-23 — Bundle hygiene, before Phase 3. Initial JS gzip: 179897 bytes (`apps/web/dist/assets/index-CmvQX7hT.js`). Early budget 235520. Phase 8 budget 256000. Lazy chunks, not in the initial number: ConnectScreen 24575 bytes (`ConnectScreen-Bsad9utP.js`), Workspace 11540 bytes (`Workspace-DW0JNnCI.js`), shared EnvChip chunk 44317 bytes (`EnvChip-Cmx54p1T.js`). CSS gzip 21228 bytes. `/__design` is absent from the production dist. Production resolves react-router to `dist/production`.
- 2026-10-24 — Phase 3. Initial JS gzip: 180217 bytes (`apps/web/dist/assets/index-Bmi6LIIc.js`). Early budget 235520. Phase 8 budget 256000. Start of phase was 179897. Lazy chunks, not in the initial number: ConnectScreen 24572 bytes (`ConnectScreen-CNHxz0bb.js`), Workspace 27131 bytes (`Workspace-DgMtF1qO.js`), shared EnvChip chunk 45053 bytes (`EnvChip-S0IorpDR.js`). CSS gzip 21491 bytes. `/__design` is absent. Machine: local Darwin, Node from the verify run. `pnpm verify`: 154 unit tests, 4 integration tests.
- 2026-10-24 — Phase 4. Initial JS gzip: 180241 bytes (`apps/web/dist/assets/index-BfifoS_0.js`), up from 180217. Early budget 235520. Phase 8 budget 256000. The grid stays in the Workspace chunk: 48688 bytes gzip (`Workspace-Dq5PvBe8.js`; Phase 3 was 27131). ConnectScreen 23313 bytes gzip (`ConnectScreen-BIoJ6yZu.js`). EnvChip 49078 bytes gzip (`EnvChip-DcB0uiD0.js`). CSS gzip 21907 bytes (`index-CZUeD1da.css`). `/__design` is absent. Scroll: 60.2 fps, Apple M5, Chromium, CPU throttle 4x, `requestAnimationFrame` scrolling the items grid by 96px for 2 seconds on the Vite dev server after 10,000 orders were loaded. `pnpm verify`: 215 unit tests, 6 integration tests. `pnpm exec playwright test --workers=1`: 22 passed.
- 2026-10-25 — Phase 5. Initial JS gzip: 181131 bytes (scripts linked from `index.html`, including `apps/web/dist/assets/index-DgzeP6bc.js`), up from 180241. Early budget 235520. Phase 8 budget 256000. Monaco is not in that entry. Lazy chunks, not in the initial number: JsonEditor 331.68 KB gzip (`JsonEditor-B4X21hQa.js`), editor.api 706.08 KB gzip (`editor.api-BefY29eV.js`), Workspace 54.98 KB gzip (`Workspace-BkdKzpeh.js`). The Monaco package also emits json, editor, html, css, and ts worker chunks. CSS gzip 22.12 KB (`index-hJASPadC.css`). `/__design` is absent. `pnpm verify`: 244 unit tests, 7 integration tests. `pnpm exec playwright test --workers=1`: 29 passed. Frozen install was not run.
- 2026-10-26 — Phase 6. Initial JS gzip: 181399 bytes (`index-OU-LJxqS.js` 177999 plus `jsx-runtime-Wy9s6hX0.js` 3400), up from 181129. Early budget 235520. Phase 8 budget 256000. The entry does not contain `monaco-editor` or `MonacoEnvironment`. Lazy chunks, not in the initial number: PartiqlPanel 7268 bytes (`PartiqlPanel-B48WaS4x.js`), monaco-setup 326601 bytes (`monaco-setup-Cii3twt0.js`), editor.api 698489 bytes (`editor.api-GF7w0OR3.js`), json.worker 127909 bytes (`json.worker-BfeARH1Q.js`), editor.worker 92399 bytes (`editor.worker-CX7Cj20z.js`), Workspace 56856 bytes (`Workspace-DpL4oEkp.js`), ConnectScreen 22818 bytes (`ConnectScreen-BckrGsoX.js`), EnvChip 54845 bytes (`EnvChip-uHTTWnDO.js`). Monaco CSS gzip 129310 bytes (`monaco-setup-CLfMljIC.css`). App CSS gzip 22048 bytes (`index-B67VEH8p.css`). `/__design` is absent. `pnpm verify`: 295 unit tests, 10 integration tests. `pnpm exec playwright test --workers=1`: 33 passed. Frozen install was not run. Machine: local Darwin.
