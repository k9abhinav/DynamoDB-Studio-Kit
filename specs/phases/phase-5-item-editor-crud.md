# Phase 5: Item Editor and CRUD

**Goal:** Open any item in a beautiful drawer, edit it safely in JSON (lossless), create, duplicate, delete, bulk delete, with conflict detection and undo.
**Specs:** 01 (EDT-1..EDT-7), 04 (items/get, PUT items, update, delete, batch-delete), 02 (ADR-002, section 6 Typed JSON), 00 Article III.
**Skills:** dynamodb-expert (typed JSON section is critical), google-minimal-ui, quality-gates, spec-driven-workflow.

## 1. In scope
**Shared:** `typed-json` module: `toPlain`, `fromPlain`, `validateTypedItem`, canonical stringify, `itemHash`, size estimator (400 KB rule), key extraction. Property-based tests.
**Server:** item routes (get, put, update, delete, batch-delete) with conditions, `expectedHash` optimistic concurrency, `ReturnValues`, read-only guard on all mutations, batch chunking and backoff.
**Web:** `ItemDrawer` (View/Edit), `JsonEditor` (Monaco lazy, theme synced, JSON schema hints for DynamoDB JSON), `ModeToggle`, validation panel, `SaveBar`, Create/Duplicate flows, Delete & Bulk delete with `ConfirmDialog`, copy menu (JSON / DynamoDB JSON / AWS CLI `put-item` command), snackbar Undo, conflict diff dialog, unsaved-changes guard.

## 2. Out of scope
Attribute-level mini editor (EDT-7; only if everything else is complete and green, else move to backlog), PartiQL, import/export.

## 3. Functional requirements
- **FR-5.1** Clicking a row opens the drawer in **View** mode with formatted JSON (default **Plain JSON** mode; toggle to **DynamoDB JSON**); `Edit` switches to editable Monaco. Mode toggle converts content in place and never loses information (sets, binary, number text preserved).
- **FR-5.2** Live validation (debounced 200ms): JSON syntax with line/column markers; typed validation (valid type tags, numbers are numeric strings, sets non-empty/unique, binary is base64); key attributes present, correct type, **unchanged when editing**; estimated size shown with a bar and warning at 350 KB and error at 400 KB.
- **FR-5.3** **Save** is disabled until valid and dirty. Save sends `items/update` with `expectedHash` from when the item was loaded. Success: snackbar "Item saved" + **Undo**, grid row updates in place (optimistic update with rollback on error).
- **FR-5.4** Conflict (`CONDITION_FAILED`): dialog with side-by-side diff (their current vs your edit), actions **Reload latest**, **Overwrite**, **Cancel**. Overwrite sends again without `expectedHash` but still requires existence.
- **FR-5.5** **Create item**: toolbar primary button opens the drawer with a template (key attributes prefilled with empty strings/zero typed per key schema). Save uses `ifNotExists: true`; on collision show friendly error offering "Open existing item".
- **FR-5.6** **Duplicate**: copies item, clears the key attribute values for editing, same save path as create.
- **FR-5.7** **Delete** (single): confirm dialog showing the key; success snackbar with **Undo** (re-`PUT` previous item with `ifNotExists`). Production-tagged connections require typed confirmation.
- **FR-5.8** **Bulk delete**: from selection action bar; confirm dialog shows count and first 5 keys; progress dialog with cancel; result summary `Deleted 118, 2 failed` with "Copy failed keys". Typed confirmation if count > 25 or env=production (type the word `DELETE` or table name for production).
- **FR-5.9** Copy menu: "Copy JSON", "Copy DynamoDB JSON", "Copy as AWS CLI put-item" (properly shell-escaped, includes `--endpoint-url` when custom).
- **FR-5.10** Unsaved changes guard: closing drawer/navigating with edits prompts "Discard changes?".
- **FR-5.11** Read-only mode: Edit/Create/Delete/Duplicate hidden or disabled with tooltip "This connection is read-only"; server also rejects.
- **FR-5.12** Undo is session-scoped (in memory), expires after 30s or on next mutation; the snackbar says so only if Undo is unavailable.
- **FR-5.13** Monaco loads lazily with a skeleton in the drawer; a no-JS-editor fallback (plain `<textarea>`) is used if Monaco fails to load (offline), with a notice.
- **FR-5.14** Drawer is keyboard-first: `Cmd/Ctrl+S` save, `Esc` close (with guard), `Cmd/Ctrl+Shift+F` format JSON, `Alt+M` toggle mode.

## 4. Tasks
- [x] T5.1 `typed-json` (toPlain/fromPlain/escape rules) tests first, including fast-check round-trip properties and the edge-cases fixtures
- [x] T5.2 `validateTypedItem`, `itemHash`, size estimator + tests
- [x] T5.3 Server `DynamoService` item operations + conditions + hash + tests; routes + integration tests (including read-only 403 and conflict)
- [x] T5.4 Batch delete with chunking, backoff, partial failures + tests (simulate UnprocessedItems)
- [x] T5.5 Web mutations with optimistic updates + rollback + tests
- [x] T5.6 `JsonEditor` Monaco wrapper (lazy, theme sync, markers from validation) + fallback + tests
- [ ] T5.7 ItemDrawer View/Edit, ModeToggle, validation panel, SaveBar + tests
- [ ] T5.8 Create/Duplicate flows + tests
- [ ] T5.9 Delete/Bulk delete UX (confirm, typed confirm, progress, summary, undo) + tests
- [ ] T5.10 Conflict diff dialog + tests
- [ ] T5.11 Copy menu (+ AWS CLI generator with escaping tests)
- [ ] T5.12 Read-only UX + tests; unsaved guard + tests
- [ ] T5.13 Playwright: edit-save-undo, conflict scenario (two sessions), create, delete, bulk delete 100 items, light/dark screenshots, axe, keyboard-only
- [ ] T5.14 Progress + phase summary (decide EDT-7 go/no-go; if no-go move to backlog)

## 5. Acceptance criteria
- **AC-5.1** Round-trip property holds for 1,000 generated items and all `edge-cases` fixtures: `fromPlain(toPlain(x))` equals `x`; stored data is unchanged after open -> save without edits (E2E compares raw item before/after).
- **AC-5.2** Editing `email` on a `users` item and saving updates the row, persists in DynamoDB (integration), and Undo restores the old value.
- **AC-5.3** Changing a key attribute in the editor blocks save with a clear message.
- **AC-5.4** Two-session conflict scenario shows the diff dialog; "Reload latest" and "Overwrite" both behave correctly (E2E).
- **AC-5.5** Creating an existing key shows the friendly collision error, not a raw AWS error.
- **AC-5.6** Bulk delete of 120 items completes with progress, handles injected unprocessed items (integration test), and reports counts accurately.
- **AC-5.7** On a production-tagged connection every delete flow requires typed confirmation (E2E).
- **AC-5.8** Read-only connection: no mutation succeeds via UI or direct API call (E2E + integration).
- **AC-5.9** Item at 390 KB opens and saves; 401 KB is blocked client-side with the explanatory message and server returns `LIMIT_EXCEEDED` if bypassed.
- **AC-5.10** Monaco is not in the initial bundle (bundle analysis assertion); offline fallback works (Playwright route abort).
- **AC-5.11** AWS CLI command for an item with quotes/unicode/newlines is valid when pasted (unit test with shell-escape cases).
- **AC-5.12** axe 0 serious/critical on drawer states; all drawer actions keyboard accessible with focus returning to the originating row.

## 6. Edge cases
Empty string values (allowed for non-key attributes); empty sets (invalid in DynamoDB: block with message); duplicate set members; numbers with exponent, leading zeros, negative zero; unicode and emoji; attribute named `$b`; very deep nesting (32 levels max, DynamoDB limit 32: warn at depth > 32); item changed between open and save by another process; deleting an item already deleted (treat as success, "Already deleted").

## 7. Definition of done
Standard phase DoD plus EDT-7 decision recorded.
