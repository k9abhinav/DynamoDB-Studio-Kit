# Phase 7: Table Management and Import/Export

**Goal:** Create and manage tables with a guided wizard; move data in and out safely with streaming, previews, progress, and error reports.
**Specs:** 01 (MGT-1..MGT-6), 04 (tables create/patch/delete/wait, export, import, clear), 02 (5.3 streaming), 00 Article III.
**Skills:** dynamodb-expert (create/GSI states, batch limits, TTL), google-minimal-ui, quality-gates, spec-driven-workflow.

## 1. In scope
**Server:** create table, update table (billing/capacity, TTL, deletion protection, GSI create/delete), delete table (typed confirm), `wait`; streaming export (NDJSON/JSON/CSV; typed or plain); import preview + import (NDJSON/JSON/CSV with mapping), dry-run, batch writes with backoff, progress events, error report store (temp files with TTL cleanup); clear table (scan + batch delete streaming).
**Web:** `CreateTableWizard` (3 steps: Keys -> Capacity/Options -> Review with request preview), Indexes tab management (add/delete GSI with status), Overview actions (TTL toggle, deletion protection, billing), Delete table dialog (typed), `ExportDialog`, `ImportWizard` (File -> Mapping/Preview -> Run), `ProgressToast`/dialog with cancel, error report download, "Clear table" in overflow menu with typed confirm.

## 2. Out of scope
Backups/PITR, global tables, S3 import/export (AWS native), auto scaling policies.

## Approved additions (2026-10-27)
- Skip-existing uses conditional `PutItem` with bounded concurrency. `BatchWriteItem` cannot carry a condition. `ConditionalCheckFailed` counts as skipped. Overwrite stays batches of 25. The UI says skip-existing is slower.
- A generated import larger than 100 MB asserts that server RSS growth stays far below the file size. Record the numbers in `specs/progress.md`.
- Error-report ids are unguessable and bound to the session and connection. Files are mode 0600 and deleted on shutdown. Another session gets 404. A multipart upload without `X-DS-CSRF` is rejected.
- Duplicate keys in the import file are counted and shown in the summary.

## 3. Functional requirements
- **FR-7.1** **Create table wizard:** Step 1 Keys (table name with live regex validation and uniqueness check, partition key name+type, optional sort key name+type). Step 2 Options (billing: On-demand default / Provisioned with RCU/WCU, GSIs add/remove with keys and projection (All/Keys only/Include list), TTL attribute optional, deletion protection toggle). Step 3 Review (human summary + "Show request"). **Create** then navigates to the new table's Overview showing `CREATING` progress until `ACTIVE`.
- **FR-7.2** GSI management: add (name, keys, projection, capacity if provisioned), delete (typed confirm), status chip (`CREATING` with backfill hint). Only one GSI create/delete in flight at a time per DynamoDB rules; UI explains when disabled.
- **FR-7.3** TTL toggle enable/disable with attribute name; explanation text "TTL deletes items after the epoch-seconds time in this attribute. Deletion can take up to 48 hours."
- **FR-7.4** Delete table: dialog explains irreversibility and shows item count (approximate); requires typing the table name always (any environment); respects deletion protection (shows friendly error with how to turn it off).
- **FR-7.5** **Export**: choose scope (This view's results / Entire table), format (NDJSON default, JSON array, CSV), representation (Plain or DynamoDB JSON; CSV flattens nested values to JSON strings and shows a warning), optional max items. Streams to a file using the File System Access API when available else a Blob download; shows count, bytes, elapsed, cancel. Entire-table export on non-loopback shows the cost hint and requires an extra click.
- **FR-7.6** **Import**: supports NDJSON, JSON array, CSV. Preview step shows the first 20 rows rendered with types; CSV step offers per-column type mapping (S/N/BOOL/JSON/skip), header row toggle, delimiter. Validation pass (dry-run) reports row-level errors (missing keys, invalid types, size > 400 KB). Modes: **Overwrite existing** (default, plain `Put`) or **Skip existing** (`attribute_not_exists` condition). Runs in batches of 25 with exponential backoff + jitter for `UnprocessedItems`; progress shows processed/written/skipped/failed and rate; cancel stops cleanly; final summary with **Download error report** (NDJSON with row number and reason).
- **FR-7.7** **Clear table**: typed confirmation (table name); scans keys only (projection), batch-deletes with progress and cancel; disabled in read-only mode; shows result summary.
- **FR-7.8** All mutating flows (create/update/delete table, import, clear) enforce read-only on the server and are hidden/disabled in the UI with tooltip.
- **FR-7.9** After any table structure change, sidebar list and Overview refresh automatically.
- **FR-7.10** Large imports don't block the UI: progress via streamed events; user can navigate elsewhere while the transfer runs (progress toast persists with a link back); closing the tab warns "Import in progress".
- **FR-7.11** Memory safety: server never buffers whole files; uses streaming parsers; hard limits (`MAX_IMPORT_BYTES` default 512 MB) with friendly error. Import error reports are kept for 1 hour and deleted on shutdown.

## 4. Tasks
- [x] T7.1 Shared schemas for create/update table, export/import options + tests
- [x] T7.2 Server create/update/delete table + `wait` + integration tests (billing modes, GSI create/delete, TTL, deletion protection, error mapping for in-use and protection)
- [ ] T7.3 Streaming serializers: NDJSON/JSON/CSV (typed & plain) + tests including CSV escaping and nested flattening
- [ ] T7.4 Server export route with backpressure + abort + integration tests (10k items)
- [ ] T7.5 Streaming parsers (NDJSON, JSON array, CSV) + type inference + mapping + tests (include malformed, BOM, CRLF, huge fields)
- [ ] T7.6 Server import preview/import with batching, backoff, modes, dry-run, error report + integration tests (simulate unprocessed items & throttling)
- [ ] T7.7 Clear table (streaming) + tests
- [ ] T7.8 Web CreateTableWizard + validation + tests
- [ ] T7.9 Web Indexes management + TTL/billing/protection controls + status polling + tests
- [ ] T7.10 Web ExportDialog + streaming download + progress/cancel + tests
- [ ] T7.11 Web ImportWizard (file, preview, mapping, dry-run, run, report) + progress toast persistence + tests
- [ ] T7.12 Delete table & Clear table dialogs + tests
- [ ] T7.13 Playwright: create table -> import CSV -> query -> export -> delete table; read-only checks; light/dark screenshots; axe; keyboard-only
- [ ] T7.14 Progress + phase summary

## 5. Acceptance criteria
- **AC-7.1** Wizard creates a table with a GSI and TTL; Overview shows the exact configuration after `ACTIVE` (E2E + integration).
- **AC-7.2** Invalid names/duplicate table names are blocked with friendly messages; AWS limits explained.
- **AC-7.3** Exporting `orders` (10,000 items) as NDJSON yields exactly 10,000 lines; re-importing into a new table reproduces identical items (compare via hash) (E2E).
- **AC-7.4** CSV export/import round trip preserves values per the documented mapping (test matrix including quotes, commas, newlines, unicode).
- **AC-7.5** Import of a 50,000-row file completes with progress, memory stays bounded (server RSS test or streaming assertion), cancel works mid-way and reports partial counts.
- **AC-7.6** Rows with errors appear in the downloadable error report with correct row numbers.
- **AC-7.7** Skip-existing mode does not overwrite existing items (integration).
- **AC-7.8** Delete/Clear table require typed confirmation; deletion protection error is friendly; read-only blocks every mutating flow (integration + E2E).
- **AC-7.9** Navigating away during import keeps progress visible via toast; tab close warns.
- **AC-7.10** axe 0 serious/critical for wizard steps and dialogs; wizards are fully keyboard-operable.

## 6. Edge cases
Table name collision with a table in `DELETING`; creating GSI on table with 10M items (backfill note); CSV with inconsistent column counts; duplicate keys within the import file (last write wins; report count of duplicates); numbers in CSV like `007` (type mapping prompt: treat as string vs number); extremely long attribute names; NDJSON with trailing blank lines; file encoding BOM/UTF-16 (detect & convert or reject with message).

## 7. Definition of done
Standard phase DoD.
