# 04. API Contract (server <-> web)

Base path: `/api/v1`. JSON unless noted. All request/response schemas are defined as Zod in `packages/shared/src/api/*` and
imported by both sides. This file is the human-readable contract; if they differ, fix whichever is wrong and keep them in sync.

## 1. Conventions
- **Auth/session:** On first request the server sets an httpOnly, SameSite=Strict cookie `ds_session`. Every mutating request also needs header `X-DS-CSRF` (value from `GET /api/v1/session`). Origin header must be allowed.
- **Connection scope:** routes under `/connections/:connectionId/...` require that the session owns that connection.
- **Item format:** items are `Record<string, AttributeValue>` in DynamoDB JSON (see ADR-002).
- **Pagination:** cursor-based. `cursor` is an opaque base64url string wrapping `LastEvaluatedKey` (or PartiQL `NextToken`). Never expose raw internals in URLs.
- **Time/size limits:** body <= 2 MB (JSON), uploads <= 512 MB (configurable). Request timeout 30s except streams.
- **Read-only:** mutating endpoints return `403 READ_ONLY` when the connection is read-only.
- **Request id:** every response has `x-request-id`; errors echo it.

## 2. Error shape
```json
{ "error": { "code": "CONDITION_FAILED", "message": "The item changed since you opened it.",
             "details": { "awsCode": "ConditionalCheckFailedException" }, "retryable": false, "requestId": "..." } }
```
### Error codes
| Code | HTTP | Typical cause |
|---|---|---|
| `VALIDATION` | 400 | Zod failure or DynamoDB ValidationException (message includes field/reason) |
| `UNAUTHENTICATED` | 401 | missing/invalid session or CSRF |
| `FORBIDDEN_ORIGIN` | 403 | bad Origin |
| `READ_ONLY` | 403 | mutation on read-only connection |
| `ACCESS_DENIED` | 403 | AWS AccessDenied / UnrecognizedClient / invalid credentials |
| `NOT_FOUND` | 404 | ResourceNotFoundException, unknown connection |
| `CONDITION_FAILED` | 409 | ConditionalCheckFailedException |
| `TABLE_IN_USE` | 409 | ResourceInUseException |
| `LIMIT_EXCEEDED` | 400/429 | LimitExceededException, item too large, etc. |
| `THROTTLED` | 429 | ProvisionedThroughputExceeded / RequestLimitExceeded (retryable) |
| `ENDPOINT_UNREACHABLE` | 502 | ECONNREFUSED, ENOTFOUND, timeout, TLS error |
| `PARTIQL_ERROR` | 400 | PartiQL parse/runtime error (include `position` if available) |
| `INTERNAL` | 500 | everything else (message generic; details only in logs) |

## 3. Endpoints

### Session
- `GET /session` -> `{ csrfToken, version }`
- `GET /health` -> `{ ok: true, version }`

### Connections
- `POST /connections/test`
  - body: `{ endpoint?: url, region: string, auth: Auth }`
  - `Auth` = `{ type: "local" } | { type: "keys", accessKeyId, secretAccessKey, sessionToken? } | { type: "profile", profile: string } | { type: "default-chain" }`
  - 200: `{ ok: true, latencyMs, tableCountSample: number }`
  - failure: error shape (e.g. `ENDPOINT_UNREACHABLE`, `ACCESS_DENIED`)
  - The server does not call STS. There is no account id in this response.
- `POST /connections`
  - body: test body + `{ name?: string, env: "local"|"dev"|"staging"|"production", readOnly: boolean, remember: boolean }`
  - 201: `{ connectionId, summary: { name, endpoint, region, env, readOnly, authType } }`
  - A blank endpoint means real AWS. Auth type `local` is then `400 VALIDATION`, and the client defaults that form to `default-chain`.
- `GET /connections` -> active connections for this session
- `GET /connections/:id` -> `{ summary, latencyMs }`. `latencyMs` is the time for `ListTables` with `Limit: 1`. Never returns secrets. This heartbeat is not rate limited.
- `DELETE /connections/:id` -> 204
- `PATCH /connections/:id` -> toggle `readOnly`, rename, change env (no credential changes)

Rate limit: 30 requests per minute per session, only on `POST /connections/test`, `POST /connections`, and `POST /profiles/:id/connect`.

### Saved profiles (never return secrets)
- `GET /profiles` -> `[{ id, name, endpoint, region, env, readOnly, authType, lastUsedAt, hasSecret }]`
- `POST /profiles/:id/connect` -> same as `POST /connections` result (server uses stored secret)
- `PATCH /profiles/:id`, `DELETE /profiles/:id`

### Tables
- `GET /connections/:id/tables?search=&cursor=&limit=100` -> `{ tables: string[], nextCursor? }` (search filters server-side by case-insensitive contains after listing pages)
- `GET /connections/:id/tables/:table` -> `TableDescription` simplified: `{ name, status, arn, keySchema: [{name,type,keyType}], attributeDefinitions, billing: {mode, rcu?, wcu?}, itemCount, sizeBytes, gsis: [...], lsis: [...], ttl: {enabled, attribute?}, stream: {...}, deletionProtection, createdAt }`
- `POST /connections/:id/tables` -> create (see MGT-1 payload) -> 202 `{ table }` (status may be CREATING)
- `PATCH /connections/:id/tables/:table` -> `{ billing?, ttl?, deletionProtection?, gsiCreate?, gsiDelete? }`
- `DELETE /connections/:id/tables/:table` -> 204 (body `{ confirm: "<tableName>" }` required)
- `POST /connections/:id/tables/:table/wait` -> poll until ACTIVE (long-poll up to 20s) `{ status }`

### Items
All under `/connections/:id/tables/:table/`
- `POST scan` body: `{ index?, limit (1-1000, default 50), cursor?, filters?: Filter[], filterJoiner?: "and"|"or" (default "and"), projection?: string[], consistentRead?: boolean, segment?: {index,total}, fillPage?: boolean }`
  -> `{ items, count, scannedCount, nextCursor?, consumedCapacity?, hasMore }`
  - `index` stays on the API for tests. The Items screen scans the base table and does not send it.
  - `fillPage: true` loops until `limit` items are collected, or 2 seconds elapse, or 10 DynamoDB calls are made, whichever comes first. A partial page returns `hasMore: true`.
- `POST query` body: `{ index?, key: { pk: {name, value}, sk?: { name, op, value, value2? } }, scanForward?, limit, cursor?, filters?, filterJoiner?: "and"|"or" (default "and"), projection?, consistentRead? }`
  -> same shape as scan, plus `request` (the generated expression preview for QRY-2).
- `POST items/get` body `{ key }` -> `{ item | null }`
- `PUT items` body `{ item, ifNotExists?: boolean, expectedHash?: string }` -> `{ item, hash }` (`CONDITION_FAILED` when `ifNotExists` and exists, or hash mismatch)
- `POST items/update` body `{ key, item (full replacement), expectedHash? }` -> `{ item, hash }` (implemented as a conditional Put with `attribute_exists(pk)`; when `expectedHash` is given, a strongly consistent Get + hash comparison runs first and, if the item is small enough, the Put also carries equality conditions on the previously loaded top-level attributes. This is best-effort concurrency control, not full atomicity; see `dynamodb-expert` skill section 5.)
- `POST items/delete` body `{ key, expectedHash? }` -> `{ deleted: boolean, previousItem? }` (uses `ReturnValues: ALL_OLD`)
- `POST items/batch-delete` body `{ keys: Key[] }` -> `{ deleted: number, failed: Key[] }` (chunks of 25, backoff for UnprocessedItems)
- `hash` = SHA-256 (base64url) of canonical typed-JSON of the item; computed server-side; used only for optimistic concurrency.

**Filter** schema: `{ attribute: string, op: "=" | "<>" | "<" | "<=" | ">" | ">=" | "between" | "begins_with" | "contains" | "not_contains" | "exists" | "not_exists" | "in" | "type_is", value?: AttributeValue, value2?: AttributeValue, values?: AttributeValue[] }`. The list has one joiner, `filterJoiner`, default `and`. A per-filter `joiner` is an unknown key and returns `400 VALIDATION`. Server builds expression with placeholders, handles reserved words and nested paths (`a.b[0].c`).

### PartiQL
- `POST /connections/:id/partiql` body `{ statement, parameters?: AttributeValue[], limit?, cursor?, consistentRead? }`
  -> `{ items, nextCursor?, kind: "select"|"mutation", affected?: number }`.
  Mutations (`INSERT`, `UPDATE`, `DELETE`) are blocked when read-only (`403 READ_ONLY`). On a writable connection they require header `X-DS-Confirm: mutation` (the UI sets it only after the confirmation dialog). A missing or wrong header is `400 VALIDATION`.

### Data transfer
- `POST .../export` body `{ format: "ndjson"|"json"|"csv", typed: boolean, scope: "all"|{scan|query request}, maxItems? }` -> streamed response with `Content-Disposition`. Progress is derived by the client from bytes/lines; server also sends trailer-like final line `{"__summary":{...}}` for ndjson.
- `POST .../import/preview` multipart file -> `{ detectedFormat, sample: Item[20], inferredColumns?, warnings[] }`
- `POST .../import` multipart (file + options JSON `{ format, mapping?, mode: "put"|"skip-existing", dryRun? }`) -> streamed NDJSON progress events: `{type:"progress", processed, written, failed}` ... final `{type:"done", ...}` with `errorsReportId`.
- `GET .../import/errors/:reportId` -> NDJSON of failed rows with reasons. Reports are kept for 1 hour and deleted on shutdown.
- `POST .../clear` body `{ confirm: "<tableName>" }` -> streamed progress like import.

## 4. Validation limits (enforced by Zod + server)
`tableName`: `^[A-Za-z0-9_.-]{3,255}$` · attribute name <= 255 chars (key names <= 255 bytes) · limit 1..1000 · filters <= 20 · keys per batch-delete <= 500 · body <= 2 MB.

## 5. Caching and headers
`Cache-Control: no-store` for all API responses. Static assets hashed + immutable.
