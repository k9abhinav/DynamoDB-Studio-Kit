# 01. Product Spec (WHAT and WHY)

## 1. Vision
**DynamoDB Studio** is the DynamoDB client you wish AWS shipped: open it, paste an endpoint, click **Connect**, and
immediately feel at home. It looks and feels like a Google product: calm, white, fast, obvious.

> "Paste a URL. Press Connect. See your data."

## 2. Personas
| Persona | Needs | Pain today |
|---|---|---|
| **Backend dev (primary)** | Inspect and fix data in DynamoDB Local and dev tables quickly | AWS console is slow and cluttered; CLI JSON is painful |
| **QA / support engineer** | Find one record, view it clearly, tweak a field safely | Afraid of breaking prod; no read-only guardrails |
| **Data-curious PM / analyst** | Browse and export data without writing queries | Query syntax is a barrier |

## 3. Principles (product)
Minimal, friendly, safe, fast, keyboard-first, beautiful in light and dark.

## 4. Core user journeys

### J1. First connection (the hero journey)
1. User opens the app and sees a centered **Connect** card on a soft background.
2. User pastes `http://localhost:8000`, picks region (auto-suggested), leaves auth on "Local (no credentials)", clicks **Connect**.
3. A subtle progress indicator runs; on success the workspace slides in with the table list loaded.
4. On failure, an inline message explains *what* failed and *how to fix it* (e.g. "Couldn't reach http://localhost:8000. Is DynamoDB Local running?").

### J2. Browse and find
Select a table -> see items in a fast grid -> use filter chips or the Query builder -> open an item in a side panel -> copy JSON.

### J3. Edit safely
Open item -> edit in JSON editor (DynamoDB JSON or Plain JSON) -> see validation live -> Save -> snackbar with **Undo** (restores previous version when possible).

### J4. Ask a question with PartiQL
Open PartiQL tab -> write statement with syntax highlighting -> run -> results in the same grid -> save the query.

### J5. Manage and move data
Create a table with guided form, add a GSI, set TTL, export results to JSON/CSV, import a JSON file with a preview.

## 5. Feature catalog (IDs are referenced by phase specs)

### A. Connection
- **CON-1** Connect screen with fields: Endpoint URL (optional for real AWS), Region, Auth method, Name (optional), Environment tag, Read-only toggle, "Remember this connection".
- **CON-2** Auth methods: **Local (no credentials)** (dummy creds), **Access key** (key id, secret, optional session token), **AWS profile** (profile name from shared config/credentials, supports SSO if the SDK resolves it), **Default credential chain** (env, IMDS, etc.).
- **CON-3** **Test connection** button (non-committal) and **Connect**.
- **CON-4** Saved connections list with last-used time, environment color dot, quick connect, edit, delete.
- **CON-5** Smart URL parsing: paste `https://dynamodb.us-east-1.amazonaws.com` -> region auto-fills; `localhost:8000` -> tag "Local" and "no credentials" preselected; bare `localhost:8000` gets `http://` prefixed.
- **CON-6** Switch connection from the app bar without a page reload; disconnect.
- **CON-7** Connection status chip (latency, region, env tag) in the app bar.

### B. Table explorer
- **TBL-1** Sidebar table list with search (instant), count, refresh, skeleton loading, infinite loading for >100 tables.
- **TBL-2** Table overview tab: status, key schema (PK/SK with types), billing mode, capacity, item count + size (with "approximate, updated ~every 6h" hint), GSIs, LSIs, TTL, streams, deletion protection, table ARN with copy.
- **TBL-3** Tabs per open table (items, overview, indexes, PartiQL); remembers last tab per table.

### C. Items browser
- **ITM-1** Virtualized data grid with sticky header, resizable columns, column visibility chooser, density toggle (comfortable/compact).
- **ITM-2** Columns inferred from loaded items; key attributes pinned first with a key icon.
- **ITM-3** Cell renderers by type with subtle type badges (S, N, B, BOOL, NULL, L, M, SS, NS, BS); long values truncated with tooltip; nested L/M shown as chips like `{3 keys}` and `[5 items]`.
- **ITM-4** **Scan** (default) and **Query** modes with a segmented toggle; page size (25/50/100/500); "Load more" and infinite scroll; abort in-flight request.
- **ITM-5** Quick filter chips (attribute, operator, value, type-aware) producing a safe FilterExpression.
- **ITM-6** Results summary: "Showing 250 items · Scanned 1,000 · 12 RCU".
- **ITM-7** Sorting: server-side by sort key (Query only); client-side for loaded rows in Scan, labelled as "sorting loaded items".
- **ITM-8** Row selection (checkbox, shift-range, select-all-loaded) with a contextual action bar.

### D. Item editor and CRUD
- **EDT-1** Right-side drawer (resizable, 420-720px) with **View / Edit** modes, using Monaco (lazy) for JSON.
- **EDT-2** Two JSON modes: **DynamoDB JSON** (lossless, `{"id":{"S":"1"}}`) and **Plain JSON** (friendly, with `$ss/$ns/$bs/$b` wrappers for sets/binary). Toggle preserves content.
- **EDT-3** Live validation: JSON syntax, key attributes present and unchanged (for update), 400 KB size estimate, empty set detection.
- **EDT-4** **Create item**, **Edit item**, **Duplicate**, **Delete**, **Bulk delete** (selected), **Copy as JSON / DynamoDB JSON / cURL-like AWS CLI**.
- **EDT-5** Safe writes: update uses `PutItem` with condition that the item still exists and (optionally) matches the loaded version hash to prevent lost updates. On conflict show a diff and offer "Reload" or "Overwrite".
- **EDT-6** Snackbar with **Undo** for edit and delete (client keeps the previous item in memory for the session).
- **EDT-7** Attribute-level mini editor (add/remove attribute, change type) as a progressive enhancement over JSON. (Phase 5, optional stretch, only if time allows; otherwise backlog.)

### E. Query builder and PartiQL
- **QRY-1** Query builder: choose Table or an Index, partition key equals value (required), sort key operator (`=`, `<`, `<=`, `>`, `>=`, `between`, `begins_with`), ascending/descending, consistent read toggle (disabled for GSI), projection (all / selected attributes), additional filter chips.
- **QRY-2** "Show request" disclosure displays the exact generated request (`KeyConditionExpression`, names, values) and a copy button.
- **QRY-3** PartiQL editor (Monaco) with run (`Cmd/Ctrl+Enter`), history, saved queries, parameter support (`?`), results in the shared grid, `NextToken` pagination.
- **QRY-4** Saved queries and history persisted locally (per connection, no secrets).
- **QRY-5** Friendly parse errors with the failing region highlighted when possible.

### F. Table management and data movement
- **MGT-1** Create table wizard: name, partition key, optional sort key, billing mode, optional GSI(s), TTL attribute, deletion protection. Preview of the request.
- **MGT-2** Delete table (typed confirmation always).
- **MGT-3** Add/delete GSI (shows backfill status). Update billing mode and capacity. Toggle TTL. Toggle deletion protection.
- **MGT-4** **Export** current result set or entire table (streamed) to JSON (DynamoDB JSON or Plain), NDJSON, or CSV; progress and cancel.
- **MGT-5** **Import** JSON/NDJSON/CSV with preview of first 20 rows, type mapping step for CSV, dry-run validation, batched writes with retry, progress, error report download.
- **MGT-6** Clear all items in a table (typed confirmation; implemented as scan + batch delete with progress). Disabled in read-only mode.

### G. App-wide
- **APP-1** Light / Dark / System theme. Density preference. Persisted locally.
- **APP-2** **Command palette** (`Cmd/Ctrl+K`): jump to table, run actions, switch connection.
- **APP-3** Keyboard shortcuts with a help dialog (`?`).
- **APP-4** Friendly empty states, skeleton loading, error boundaries, offline/disconnected banner.
- **APP-5** Responsive down to 1024px wide; usable on tablet; mobile is out of scope but must not break.
- **APP-6** About dialog: version, link to docs (no telemetry).

## 6. Non-goals (explicitly out of scope for v1)
- Multi-user auth, hosted SaaS, cloud sync of connections.
- Transactions UI (`TransactWriteItems`) and streams viewer.
- Backup/restore/PITR management, global tables management, DAX, resource policies.
- Data modeling tools / NoSQL Workbench-style model designer.
- Mobile layouts.

## 7. Success metrics (v1)
- New user reaches a loaded table within **20 seconds** of first launch (J1).
- Opening a table with 10,000 loaded rows scrolls at 60 fps on a mid-range laptop.
- Zero unlabeled interactive elements (axe: 0 serious/critical violations).
- Every destructive flow has a confirmation and a test.

## 8. Tone and copy
Friendly, short, specific. Examples:
- Good: "Couldn't reach `http://localhost:8000`. Is DynamoDB Local running?"
- Bad: "ECONNREFUSED"
- Empty table: "This table is empty. Add your first item."
- Success: "Item saved" with **Undo**.
