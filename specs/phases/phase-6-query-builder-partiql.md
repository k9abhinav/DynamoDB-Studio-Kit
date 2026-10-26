# Phase 6: Query Builder and PartiQL

**Goal:** Ask precise questions two ways: a friendly visual Query builder (with transparent generated requests) and a powerful PartiQL editor with history and saved queries.
**Specs:** 01 (QRY-1..QRY-5), 04 (query, partiql), 02 (ADR-004), 03 (QueryBuilder, PartiQLEditor).
**Skills:** dynamodb-expert (Query vs Scan, key conditions, PartiQL notes), google-minimal-ui, quality-gates, spec-driven-workflow.

## 1. In scope
**Server:** `POST query` (table or index, key condition builder, sort direction, limit/cursor, filters, projection, consistent read rules), `POST partiql` (`ExecuteStatement` with parameters, `NextToken`), PartiQL statement classification (select vs mutation) with a tokenizer-level classifier (not regex on raw text; ignore comments/strings), mutation confirmation header and read-only enforcement.
**Web:** Scan/Query segmented toggle fully functional; `QueryBuilder` form; "Show request" disclosure; PartiQL tab with Monaco (lazy, PartiQL/SQL-like highlighting via a minimal custom Monarch grammar), run/stop, history (last 100 per connection), saved queries (name, statement, table optional), results in the shared `DataGrid`; keyboard shortcuts; friendly errors with position highlighting.

## 2. Out of scope
Query plan estimation; multi-statement batch; transactions; autocomplete beyond basic table/attribute name suggestions (stretch: table and key attribute names as Monaco completions).

## 3. Functional requirements
- **FR-6.1** Query builder shows: Target (Table or index; GSI/LSI listed with key schema), **Partition key** (`name = value`, type-aware input), **Sort key** (operator select + value inputs; `between` shows two inputs), **Sort order** (ascending/descending), **Consistent read** (disabled with explanatory tooltip for GSI), **Projection** (All / pick attributes), plus the shared filter chips for non-key conditions.
- **FR-6.2** Values are typed by the key schema (S/N/B); numbers validated as numeric strings; binary as base64 or hex converted; invalid input shows inline helper text before running.
- **FR-6.3** Run with `Enter` in a field or the primary **Run query** pill (`Cmd/Ctrl+Enter`). Results use the same grid, summary bar, pagination, selection and drawer as Scan. Switching Scan <-> Query preserves common state (page size, columns) but not filters unless the user opts in.
- **FR-6.4** "Show request" disclosure displays the exact JSON that will be sent (`TableName`, `IndexName`, `KeyConditionExpression`, `ExpressionAttributeNames/Values`, `ScanIndexForward`, `Limit`, `ProjectionExpression`) with copy button and an "AWS CLI" tab.
- **FR-6.5** If the user fills only the sort key or leaves the partition key empty, Run is disabled and a hint explains "Query needs a partition key value. Use Scan to browse without one."
- **FR-6.6** PartiQL editor: statement area, **Run** (`Cmd/Ctrl+Enter`), Stop, parameters panel (add `?` parameters typed with a small type picker), results grid, `Load more` using `NextToken`. History drawer; save query dialog; saved list with search; items persisted in `localStorage` namespaced by connection fingerprint (endpoint+region+account-less hash), **never** secrets.
- **FR-6.7** PartiQL mutation flow: when classifier says mutation, show confirmation dialog stating the statement kind and warning; production requires typed confirmation; after success show `affected` count (when determinable) and a snackbar. Read-only connection blocks with `READ_ONLY`.
- **FR-6.8** Parse and runtime errors show message and, if the error includes a position, highlight the region in Monaco and mark the line.
- **FR-6.9** Starter templates menu (e.g. `SELECT * FROM "<table>" WHERE ...`, with the current table name inserted and quoted correctly).
- **FR-6.10** A PartiQL `SELECT` without `WHERE` on a non-loopback endpoint shows the same one-time cost hint as Scan.
- **FR-6.11** Cancel: Stop aborts the fetch; server stops (no orphan loops).

## 4. Tasks
- [x] T6.1 Key-condition builder in `ExpressionBuilder` (all operators, name/value placeholders, validation rules like `begins_with` only for S/B) tests first
- [x] T6.2 Server `query` + route + integration tests (table, GSI, LSI if seeded, desc order, between, begins_with, filters, projection, pagination, consistent read rules)
- [x] T6.3 PartiQL statement classifier (tokenizer-based) + tests for tricky inputs (strings containing "DELETE", comments, mixed case, leading whitespace). Fail closed: empty input, typos, and more than one statement separated by `;` are mutations. Table-driven tests cover those.
- [x] T6.4 Server `partiql` + route + integration tests (select with params, pagination via NextToken, mutation confirm header, read-only). The server classifies the statement itself and ignores any client-sent kind. A `DELETE` sent with a header that implies a select is still a mutation. `NextToken` cursors hash the statement, parameters, and consistent read; a mismatch is `400 VALIDATION`.
- [x] T6.5 Web `QueryBuilder` form + validation + "Show request" + tests
- [x] T6.6 Scan/Query toggle integration with grid, summary, pagination + tests
- [x] T6.7 PartiQL editor (Monaco, Monarch grammar, error markers) + run/stop + results + tests
- [x] T6.8 History + Saved queries (storage layer with versioned schema) + tests. Include a Clear history action for local history and for saved queries.
- [x] T6.9 Mutation confirmation UX + typed confirmation + tests
- [x] T6.10 Playwright: query `orders` by userId + sort key range via GSI and base table; PartiQL select/update; history/saved; light/dark screenshots; axe; keyboard-only
- [x] T6.11 Progress + phase summary

## 5. Acceptance criteria
- **AC-6.1** Query on `orders` by `userId` with `createdAt between X and Y` returns exactly the expected items in descending order (integration).
- **AC-6.2** GSI `status-createdAt-index` query works; consistent read control is disabled for it.
- **AC-6.3** "Show request" output equals the request captured by the server for the same run (test compares).
- **AC-6.4** Reserved words (`status`, `name`, `timestamp`) work in key conditions and filters (integration).
- **AC-6.5** PartiQL classifier tests: `select`, `SELECT`, leading comments, `-- DELETE` in a comment, a string containing `'DELETE'`, `UPDATE`, `INSERT`, `DELETE` all classified correctly (table-driven). Empty input, typos, and multiple statements separated by `;` are mutations.
- **AC-6.6** PartiQL `UPDATE` on a read-only connection returns `READ_ONLY`; on a writable connection, a direct API call without `X-DS-Confirm: mutation` returns `400 VALIDATION`. The server classifies independently: a `DELETE` sent with a header implying a select is still a mutation.
- **AC-6.7** History keeps the last 100 per connection, de-duplicates consecutive identical statements; saved queries survive reload; no secrets stored (inspect localStorage in test). Clear history removes local history and saved queries.
- **AC-6.8** Position-based error highlighting works for a seeded syntax error. If DynamoDB Local returns no position, the evidence is the component test, and progress says AWS was not checked.
- **AC-6.9** Stop cancels long-running PartiQL pagination (test asserts server loop ends).
- **AC-6.10** axe 0 serious/critical on Query and PartiQL views; keyboard-only run via `Cmd/Ctrl+Enter` works.

## 6. Edge cases
Number sort key values with decimals; begins_with on number key (blocked with message); partition key value empty string (invalid for key); table with only a partition key (sort key controls hidden); PartiQL table names with dots/dashes (quoted); PartiQL `SELECT` from an index (`"table"."index"` syntax); parameter count mismatch; statements > 8 KB; pasting statements with Windows line endings.

## 7. Definition of done
Standard phase DoD.
