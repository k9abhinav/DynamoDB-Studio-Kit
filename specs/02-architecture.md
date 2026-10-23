# 02. Architecture (HOW)

## 1. System overview

```
┌──────────────────────────── Browser (apps/web) ────────────────────────────┐
│ React 19 · MUI · Tailwind v4 · TanStack Query/Table/Virtual · Zustand      │
│  - Connect screen, Workspace, Grid, Editor (Monaco), Query/PartiQL          │
│  - Holds NO AWS credentials. Talks only to /api/v1 on same origin           │
└───────────────▲─────────────────────────────────────────────────────────────┘
                │ HTTPS/HTTP (localhost) · JSON · NDJSON streams · session cookie
┌───────────────┴──────────────── Server (apps/server) ──────────────────────┐
│ Fastify · Zod · Pino                                                        │
│  - ConnectionManager (in-memory sessions, optional encrypted profile store) │
│  - DynamoService (SDK v3 wrapper), ExpressionBuilder, ErrorMapper           │
│  - Guards: origin check, session token, read-only enforcement, rate limit   │
└───────────────▲─────────────────────────────────────────────────────────────┘
                │ AWS SDK v3 (custom endpoint, region, credentials provider)
┌───────────────┴─────────────────┐
│ DynamoDB (AWS) / DynamoDB Local │
└─────────────────────────────────┘
```

In production builds the server also **serves the built web app** (single process, single port, default `8080`).
In dev, Vite serves the web on `5173` and proxies `/api` to the server on `8080`.

The rate limit is 30 requests per minute per session, and it applies only to `POST /connections/test`, `POST /connections`, and `POST /profiles/:id/connect`. `GET /connections/:id` (the heartbeat) is not rate limited.

## 2. Monorepo layout

```
/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/                 # App.tsx, providers, router, theme
│   │   │   ├── features/
│   │   │   │   ├── connection/      # connect screen, saved connections
│   │   │   │   ├── workspace/       # shell, sidebar, tabs
│   │   │   │   ├── tables/          # list, overview, management
│   │   │   │   ├── items/           # grid, filters, query builder
│   │   │   │   ├── editor/          # item drawer, monaco wrapper
│   │   │   │   ├── partiql/         # editor, history, saved
│   │   │   │   └── data-transfer/   # import/export
│   │   │   ├── components/          # shared UI primitives (EmptyState, ConfirmDialog, ...)
│   │   │   ├── lib/                 # api client, query keys, utils, hotkeys
│   │   │   ├── stores/              # zustand stores (ui, workspace)
│   │   │   └── styles/              # tailwind.css, tokens.css
│   │   ├── index.html
│   │   └── vite.config.ts
│   └── server/
│       └── src/
│           ├── index.ts             # bootstrap
│           ├── app.ts               # buildApp() for tests
│           ├── config.ts
│           ├── plugins/             # security, errors, session, static
│           ├── routes/              # connections, tables, items, partiql, transfer
│           ├── services/            # connection-manager, dynamo-service, transfer
│           ├── dynamo/              # marshal, expressions, errors, pagination, retry
│           └── store/               # encrypted profile store
├── packages/
│   └── shared/
│       └── src/                     # zod schemas, types, constants, typed-json helpers
├── docker-compose.yml               # dynamodb-local
├── scripts/                         # seed-data.ts, etc.
├── specs/  .claude/  prompts/
├── pnpm-workspace.yaml  package.json  tsconfig.base.json  eslint.config.js
└── .github/workflows/ci.yml
```

## 3. Architecture Decision Records

### ADR-001: Thin local backend (BFF) instead of browser-only
- **Decision:** Fastify server holds SDK clients and credentials.
- **Why:** Credentials stay out of the browser; no CORS/preflight surprises against arbitrary endpoints; enables streaming export/import, retries, and read-only enforcement; same pattern as other DB GUIs.
- **Trade-off:** One extra process. Mitigated by single-process production build and a one-line launch (`npx`/Docker, Phase 8).

### ADR-002: Typed JSON ("DynamoDB JSON") is the canonical wire format
- **Decision:** Items travel as `Record<string, AttributeValue>` (e.g. `{"S":"x"}`, `{"N":"12"}`). The server never converts to JS numbers.
- **Why:** Lossless, preserves sets and binary, avoids ambiguity.
- **Plain JSON view** is a *client-side* projection implemented in `packages/shared/typed-json` with full round-trip tests (see section 6).

### ADR-003: MUI + Tailwind coexistence
- **Decision:** MUI provides components, theming and a11y. Tailwind v4 provides layout/spacing utilities. Both read the same tokens.
- **How:** Use CSS layers so Tailwind utilities can override MUI predictably, with no `!important` hacks:
  - `index.css`: `@layer theme, base, mui, components, utilities;` then `@import "tailwindcss";`
  - Wrap the app in MUI `<StyledEngineProvider enableCssLayer>` and add `<GlobalStyles styles="@layer theme, base, mui, components, utilities;" />`.
  - Tokens are defined once in `src/app/theme.ts` (MUI) and mirrored as CSS variables in `styles/tokens.css`, consumed by Tailwind via `@theme`.
- **Rule:** MUI for interactive components (buttons, inputs, dialogs, menus, tabs, tooltips). Tailwind for page/section layout, flex/grid, gaps, padding, responsive and truncation. Never style MUI internals with Tailwind arbitrary selectors unless wrapped in a documented helper.

### ADR-004: Data fetching with TanStack Query
- Query keys are centralized in `lib/query-keys.ts`. Infinite queries for scan/query/PartiQL pages. `AbortSignal` is passed through to the API client. Mutations invalidate by key.

### ADR-005: Grid = TanStack Table + TanStack Virtual (custom styled), not MUI X Data Grid
- **Why:** Full control over look (Google-like), no licensing concerns for column pinning/resizing, best virtualization performance, lighter bundle.
- **Trade-off:** More code. Mitigated by one well-tested `DataGrid` component reused by Scan, Query and PartiQL.

### ADR-006: Monaco lazily loaded
- `@monaco-editor/react` with dynamic `import()`, loaded only when an editor is first opened. Theme synced with app theme.

### ADR-007: State management
- Server state: TanStack Query. UI state: Zustand (theme, density, drawer, open tabs). URL is the source of truth for the selected connection/table/tab (`/c/:connId/t/:table/:tab`) so refresh and deep links work.

### ADR-008: Connection persistence
- Sessions: in-memory on the server (Map keyed by connectionId, bound to the browser session token).
- Saved profiles: `~/.dynamo-studio/profiles.json` (path overridable via `DYNAMO_STUDIO_HOME`). Secrets only stored when "Remember" is checked; encrypted with AES-256-GCM using a random key in `~/.dynamo-studio/key` (file mode `0600`). Documented honestly as "protects against casual disclosure, not a compromised user account".

## 4. Approved dependencies (add others only with justification)

**web:** react, react-dom, react-router-dom, @mui/material, @mui/icons-material, @emotion/react, @emotion/styled, tailwindcss, @tailwindcss/vite, @tanstack/react-query, @tanstack/react-table, @tanstack/react-virtual, zustand, react-hook-form, @hookform/resolvers, zod, @monaco-editor/react, lossless-json, date-fns, clsx, @fontsource/roboto, @fontsource/roboto-mono. The command palette and snackbars use MUI. Do not add `cmdk` or `notistack`.
**server:** fastify, @fastify/cookie, @fastify/static, @fastify/multipart, @fastify/rate-limit, @aws-sdk/client-dynamodb, @aws-sdk/util-dynamodb (tests and fixtures only), @aws-sdk/credential-providers, zod, pino, pino-pretty (dev). The product path uses `client-dynamodb` so numbers stay strings. Do not add `lib-dynamodb`.
**dev:** typescript, vite, vitest, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, msw, playwright, @axe-core/playwright, eslint (flat config), typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y, prettier, husky, lint-staged, tsx.

## 5. Key flows

### 5.1 Connect
```
Web: POST /api/v1/connections/test   {endpoint, region, auth}   -> ListTables(Limit=1) + latency
Web: POST /api/v1/connections        {... + name, env, readOnly, remember}
Srv: build DynamoDBClient (custom endpoint, region, credentials provider)
Srv: verify with ListTables(Limit=1), store session, return {connectionId, summary}
Web: navigate to /c/:connectionId
```
Local auth uses static dummy credentials (`local`/`local`). Never ask the user for keys when connecting to loopback, unless they choose another auth mode.

### 5.2 Scan/Query pagination
Server returns `{ items, count, scannedCount, nextCursor, consumedCapacity, hasMore }`. `nextCursor` is an opaque base64url string. The client stores that cursor and sends it back as `cursor`. It does not see `LastEvaluatedKey`. Server enforces `Limit` (<= 1000). When `fillPage` is true, the server loops until it has collected the page size, or 2 seconds have elapsed, or 10 calls have been made, whichever comes first, then returns the partial page with `hasMore: true`.

### 5.3 Streaming export / import
- Export: `POST .../export` returns `application/x-ndjson` (or CSV) as a stream; client uses `fetch` + `ReadableStream` to show progress and to save via `showSaveFilePicker` or Blob fallback. Abort cancels server work via `request.raw.on('close')`.
- Import: multipart upload, server parses incrementally, writes with `BatchWriteItem` (25/batch) + backoff, streams progress events (SSE or NDJSON) including per-batch error samples.

## 6. Typed JSON <-> Plain JSON (critical, test heavily)

| DynamoDB | Plain JSON representation |
|---|---|
| `{"S":"a"}` | `"a"` |
| `{"N":"12.50"}` | `12.50` (parsed with `lossless-json`, serialized back as the **same digits**) |
| `{"BOOL":true}` | `true` |
| `{"NULL":true}` | `null` |
| `{"L":[...]}` | `[...]` |
| `{"M":{...}}` | `{...}` |
| `{"SS":["a","b"]}` | `{"$ss":["a","b"]}` |
| `{"NS":["1","2.5"]}` | `{"$ns":["1","2.5"]}` |
| `{"BS":["QUI="]}` | `{"$bs":["QUI="]}` |
| `{"B":"QUI="}` | `{"$b":"QUI="}` |

Rules: an object whose only key is one of `$ss,$ns,$bs,$b` is a typed wrapper; any other object is a Map. On output, a map key that is `$b`, `$ss`, `$ns`, or `$bs`, or that already begins with `$$`, gains one more leading `$` (`$b` becomes `$$b`, `$$b` becomes `$$$b`). On input, a map key that begins with `$$` loses exactly one leading `$`. Wrapper objects are recognized before that unescaping. Round-trip property: `fromPlain(toPlain(x)) deep-equals x` for all valid items (property-based tests). Plain JSON parse and stringify go through `lossless-json`, so number digits survive the round trip.

## 7. Error model
All server errors are `{ error: { code, message, details?, retryable, requestId } }` (see `04-api-contract.md`). The `ErrorMapper` converts AWS SDK errors and network errors to stable codes. The web maps codes to friendly copy in one file (`lib/error-copy.ts`).

## 8. Configuration (server)
| Env var | Default | Notes |
|---|---|---|
| `PORT` | `8080` | |
| `HOST` | `127.0.0.1` | non-loopback prints a warning |
| `DYNAMO_STUDIO_HOME` | `~/.dynamo-studio` | profiles and key |
| `LOG_LEVEL` | `info` | |
| `ALLOWED_ORIGINS` | (same-origin + `http://localhost:5173` in dev) | |
| `MAX_EXPORT_ITEMS` | unlimited | safety valve |

## 9. Performance strategy
Virtualized rows and columns where needed, memoized cell renderers, `content-visibility` for offscreen panels, `React.lazy` for routes and Monaco, debounced search, cancel stale queries, avoid re-render storms (selectors in Zustand), image-free UI, system font fallbacks to avoid layout shift.
