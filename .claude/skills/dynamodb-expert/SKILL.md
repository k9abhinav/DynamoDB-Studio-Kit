---
name: dynamodb-expert
description: DynamoDB domain rules for DynamoDB Studio. Use whenever touching marshalling/typed JSON, Scan/Query, expressions, pagination, batch/transactional writes, PartiQL, table/GSI/TTL operations, error mapping, or DynamoDB Local behavior. Prevents precision loss, injection, pagination bugs, and cost surprises.
---

# DynamoDB Expert

## 1. Data model and types
| Tag | Meaning | Notes |
|---|---|---|
| `S` | string | empty strings allowed for non-key attributes; keys must be non-empty |
| `N` | number (as **string**) | up to 38 digits precision; magnitude 1E-130..9.99E+125; **never** `Number()` it |
| `B` | binary (base64 string on the wire) | |
| `BOOL` | boolean | |
| `NULL` | `true` | distinct from a missing attribute |
| `L` | list of AttributeValues | heterogeneous, ordered |
| `M` | map of name -> AttributeValue | |
| `SS`/`NS`/`BS` | sets | **non-empty**, **unique**, unordered, homogeneous. Number sets are strings |

- Item size limit: **400 KB** (attribute names + values). Nesting depth limit: **32** levels.
- Key attribute types allowed: `S`, `N`, `B` only.
- Use `@aws-sdk/client-dynamodb` (low-level, typed JSON in/out). Use `util-dynamodb` `marshall/unmarshall` **only** for tests/fixtures; the product's canonical format is typed JSON end to end. If lib-dynamodb is used, enable `wrapNumbers: true` so numbers stay lossless.

## 2. Expressions (non-negotiable)
- ALWAYS use `ExpressionAttributeNames` (`#n0`) for every attribute path segment and `ExpressionAttributeValues` (`:v0`) for every value. Never interpolate user text.
- Nested paths: `a.b[0].c` -> split into segments, alias each name segment (`#n0.#n1[0].#n2`). List indexes are literal integers (validate `^\d+$`).
- Reserved words (hundreds: `name`, `status`, `timestamp`, `data`, `size`, `type`, `year` ...) are a non-issue when everything is aliased. Do not maintain a reserved-word list; always alias.
- Placeholders must all be **used** or DynamoDB throws `ValidationException` (unused names/values). The builder must only emit placeholders it references.
- Operators/functions: comparison `= <> < <= > >=`, `BETWEEN a AND b`, `IN (...)` (filters only, max 100 values), `attribute_exists`, `attribute_not_exists`, `attribute_type`, `begins_with`, `contains`, `size`. Combine with `AND`/`OR`/`NOT`, parentheses for precedence (build from an AST, not string concat).
- **KeyConditionExpression**: partition key `=` required; sort key optional with `= < <= > >= BETWEEN begins_with`. No `OR`, no `<>`, no `contains` in key conditions. `begins_with` works on `S` and `B` sort keys only (not `N`).
- **FilterExpression** cannot reference key attributes in Query (partition/sort keys belong in the key condition). Filters are applied **after** reading, so they don't reduce consumed read capacity.
- **ProjectionExpression**: aliased paths joined by commas.
- Update semantics: this app edits items as **full replacement** with conditional `PutItem` (see API contract). If `UpdateItem` is ever used: `SET`, `REMOVE`, `ADD`, `DELETE` clauses; each attribute may appear once; use `if_not_exists`, `list_append`.

## 3. Scan vs Query
- **Query** needs the partition key; reads only that partition; supports sort-key conditions, ordering (`ScanIndexForward`), and is cheap. **Scan** reads everything, 1 MB per call, filters applied after.
- `Limit` limits items **evaluated**, not returned. With filters a page may return 0 items yet have `LastEvaluatedKey`. Hence the `fillPage` loop with a time/call budget (Constitution + FR-4.3): loop while `items.length < pageSize && LastEvaluatedKey && budget remains`; return `hasMore` truthfully.
- `LastEvaluatedKey` present => more data may exist; absent => done. `Count` = returned after filter; `ScannedCount` = evaluated before filter.
- `ExclusiveStartKey` must be exactly a previous `LastEvaluatedKey` (for GSIs it includes table keys + index keys).
- Response size cap: 1 MB per call before filtering.
- `ConsistentRead`: strongly consistent reads **not supported on GSIs**; allowed on base table and LSIs. Costs 2x RCU vs eventual.
- GSI results are eventually consistent; items may lag after writes. Say so in tooltips where relevant.
- `ReturnConsumedCapacity: "TOTAL"` gives RCU; display it, don't compute it yourself.
- Parallel scan uses `Segment`/`TotalSegments`; keep as backlog.

## 4. Pagination cursors
`cursor = base64url(JSON({ v:1, lek: <LastEvaluatedKey typed JSON>, ctx: <hash of request shape> }))`. On decode validate shape with Zod and verify the `ctx` hash matches the current request parameters (table/index/filters/direction) to prevent mixing cursors across queries. PartiQL cursors wrap `NextToken` the same way.

## 5. Writes
- `PutItem` replaces the whole item. Conditions: `attribute_not_exists(<pk>)` for create; `attribute_exists(<pk>)` for update.
- **Optimistic concurrency (`expectedHash`)** is best-effort because we do not own the user's schema (no version attribute). Implement in two layers:
  1. Strongly consistent `GetItem`, compute `itemHash`, and reject with `CONDITION_FAILED` if it differs from `expectedHash`.
  2. `PutItem` with `attribute_exists(<pk>)` AND, when the expression budget allows (<= ~150 top-level attributes and the expression stays well under the 4 KB limit), an equality condition for every top-level attribute against the previously loaded value (`#n = :v`; `=` works for all types). This closes most of the race window.
  - Residual race: an attribute **added** by another writer between the read and the write is not detected. Document this honestly in `docs/ARCHITECTURE.md`; never claim full atomicity.
  - If the item is too large for layer 2, fall back to layer 1 plus the existence condition and flag `details.weakConcurrency = true`.
- `DeleteItem` with `ReturnValues: ALL_OLD` returns the previous item for Undo.
- `BatchWriteItem`: max **25** requests, max 16 MB total, **no conditions**, may return `UnprocessedItems` -> retry with exponential backoff + full jitter (base 50ms, cap 2s, max ~8 attempts); report leftovers as failed. Duplicate keys in one batch are rejected: de-duplicate (last wins) first.
- `BatchGetItem`: max 100 keys, 16 MB; handle `UnprocessedKeys`.
- Transactions are out of scope (backlog).
- TTL: attribute must be Number (epoch **seconds**); deletion within ~48h after expiry; expired-but-not-yet-deleted items still appear in scans.

## 6. Table operations
- `CreateTable`: `AttributeDefinitions` must list **only** attributes used as keys (table and index keys); `KeySchema` order HASH then RANGE. `BillingMode: PAY_PER_REQUEST` or `PROVISIONED` with `ProvisionedThroughput` on table and on each GSI (provisioned only).
- Statuses: `CREATING`, `ACTIVE`, `UPDATING`, `DELETING`, `ARCHIVING`, `ARCHIVED`, `INACCESSIBLE_ENCRYPTION_CREDENTIALS`. Poll `DescribeTable` until `ACTIVE`.
- `UpdateTable`: one GSI create or delete per call (and only one GSI backfill at a time); billing mode switch limited to once per 24h on AWS; `DeletionProtectionEnabled`.
- `UpdateTimeToLive` takes `{ Enabled, AttributeName }`; `DescribeTimeToLive` for state.
- `DescribeTable.ItemCount`/`TableSizeBytes` update roughly every **6 hours**: label "approximate".
- `ListTables`: max 100 per page, use `ExclusiveStartTableName` / `LastEvaluatedTableName`.
- Table name regex: `[a-zA-Z0-9_.-]{3,255}`. Index name same rules (3-255).

## 7. PartiQL
- `ExecuteStatement` with `Statement`, optional `Parameters` (typed JSON AttributeValues, `?` placeholders), `NextToken`, `Limit`, `ConsistentRead`.
- Table and index names are double-quoted: `SELECT * FROM "my-table"` and `FROM "my-table"."my-index"`. Strings use **single quotes**.
- A `SELECT` without `WHERE` on keys becomes a **full scan**. PartiQL `UPDATE`/`DELETE` require the full primary key in `WHERE`.
- `INSERT INTO "t" VALUE {'pk': 'x', 'n': 1}`. Result pagination via `NextToken` (not `LastEvaluatedKey`).
- Classify statements with a tokenizer (skip comments `--`, `/* */`, and string literals) to find the first keyword; never regex on raw text.

## 8. Error mapping (see `04-api-contract.md` codes)
| AWS / network | Code | Friendly copy hint |
|---|---|---|
| `ResourceNotFoundException` | `NOT_FOUND` | "That table doesn't exist (anymore)." |
| `ConditionalCheckFailedException` | `CONDITION_FAILED` | "This item changed since you opened it." / "An item with this key already exists." |
| `ValidationException` | `VALIDATION` | include message; many are user-fixable |
| `ProvisionedThroughputExceededException`, `RequestLimitExceeded`, `ThrottlingException` | `THROTTLED` | retryable; SDK already retried |
| `ResourceInUseException` | `TABLE_IN_USE` | "Table is busy. Try again when it's ACTIVE." |
| `LimitExceededException`, `ItemCollectionSizeLimitExceededException` | `LIMIT_EXCEEDED` | |
| `AccessDeniedException`, `UnrecognizedClientException`, `InvalidSignatureException`, `ExpiredTokenException` | `ACCESS_DENIED` | |
| `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `EAI_AGAIN`, TLS errors | `ENDPOINT_UNREACHABLE` | |
| `TransactionCanceledException` etc. | `INTERNAL` unless used | |
Also preserve `$metadata.requestId` and the raw AWS error `name` in `details`.

## 9. DynamoDB Local specifics
- Image `amazon/dynamodb-local`, default port 8000. Any non-empty access key/secret works; region is arbitrary but part of the DB file name unless `-sharedDb`. Use `-sharedDb` in compose to avoid "table not found" confusion across regions/keys.
- No real throttling/capacity enforcement; `ConsumedCapacity` is returned but not meaningful for cost.
- Some features differ (e.g. TTL deletion is simulated but not guaranteed timing, no streams parity guarantees, PartiQL supported). Do not assert on timing-based AWS behavior in tests.
- In-memory mode (`-inMemory`) wipes on restart; fine for tests.
- Loopback detection decides defaults and cost-hint behavior (Phase 2).

## 10. Testing playbook
- Unit-test the expression builder as a pure function: input AST -> `{ expression, names, values }`. Assert placeholders all used; assert no user text in `expression`.
- Property tests for typed-JSON round trip and cursor codec.
- Integration tests only against DynamoDB Local; create unique table names per test file; clean up in `afterAll`.
- Edge-case fixtures: 38-digit numbers (`12345678901234567890123456789012345678`), `1E+2`, `-0`, empty string, unicode/emoji, set types, binary, nested 30-level map, 390 KB item, attribute names with spaces/dots/`$`.
