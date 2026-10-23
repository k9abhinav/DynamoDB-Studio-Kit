# Master plan

Approved 2026-10-23. This is the roadmap and the locked decisions for v1.
The spec edits in section 8 are already applied. Phase 0 has not started. The next session runs `/phase 0`.

## 1. Understanding

DynamoDB Studio is a local, single-user client for backend developers, QA, and analysts who need to inspect and fix DynamoDB Local or AWS tables without the AWS console. The hero path is: paste an endpoint, press Connect, see tables, open an item.

"Beautiful, simple, minimal, Google-like" means quiet chrome and loud data: Roboto, Google Blue (`#1A73E8`) as the only accent, white or near-black surfaces, 1px borders, pill primary buttons, sentence case, and motion only as feedback. Material UI owns interactive components and accessibility. Tailwind owns layout and spacing. One primary action per screen. Light, dark, and system themes are both designed. Destructive actions are confirmed; production and large deletes require typing a confirmation; read-only is enforced on the server.

## 2. Architecture confirmation

Stack stays as specified: pnpm workspaces, React 19 + Vite, MUI, Tailwind CSS v4, TanStack Query / Table / Virtual, Zustand, React Router, Monaco (lazy), Node 22, Fastify, AWS SDK v3, Zod, Pino. Layout matches `02-architecture.md`. ADRs 001 through 008 stand.

Versions named during planning, from docs on 23 Oct 2026, with nothing installed yet: `@mui/material` 9.4.0 (27 Aug 2026) and `tailwindcss` 4.3 with `@tailwindcss/vite`. Phase 0 confirms every pinned version against the npm registry before `pnpm install`, and records the exact versions in `progress.md`. If the registry disagrees with these numbers, the registry wins and the difference is logged.

CSS APIs locked for Phase 1, checked against current MUI and Tailwind docs:

- The Vite + Tailwind v4 recipe is `StyledEngineProvider enableCssLayer` plus `GlobalStyles` declaring `@layer theme, base, mui, components, utilities`. That line comes before `@import "tailwindcss"`, which already defines `theme, base, components, utilities`. Tokens use `@theme inline` pointing at `--ds-*` variables.
- Theme: `cssVariables: { colorSchemeSelector: '[data-color-scheme="%s"]' }` with `colorSchemes: { light, dark }`. An inline script in `index.html` sets `data-color-scheme` before React mounts, using the `mui-mode` storage key. `InitColorSchemeScript` alone is too late for a Vite SPA.
- `modularCssLayers` stays off. Turn it on only if the Phase 1 test (`rounded-none` on a MUI Card, no `!important`) fails.
- MUI 9.4 adds opt-in `theme.focusVisible`. Phase 1 uses it if it can produce a 2px primary ring with 2px offset; otherwise the ring stays a theme override.
- Product path uses `@aws-sdk/client-dynamodb`. `@aws-sdk/util-dynamodb` is for tests and fixtures only. `@aws-sdk/lib-dynamodb` is not added. Snackbars and the command palette use MUI. `cmdk` and `notistack` are not added.

Locked product decisions:

- Query is a Scan | Query control on the Items tab. Tabs are Items, PartiQL, Overview, Indexes.
- A filter list has one joiner, AND or OR.
- Snackbars last 4 seconds. When Undo is present they stay until Undo, dismiss, or 30 seconds.
- Conflict checks stay best-effort, as in the DynamoDB skill: consistent read plus hash, then per-attribute conditions when the expression fits. The UI says the check is best-effort when a conflict appears.
- The connect rate limit is 30 requests per minute per session, and it applies only to `POST /connections/test`, `POST /connections`, and `POST /profiles/:id/connect`. The `GET /connections/:id` heartbeat is not limited.

## 3. Phase roadmap

Dependencies: 0, then 1, then 2. Phase 2 needs the shell from 1. Then 3, 4, 5, 6, 7, 8 in order. Phase 6 uses the Phase 5 drawer. Phase 7's journey uses query and export together.

- **Phase 0 — Foundation (M).** Tooling, health endpoint, shared Zod pipeline, DynamoDB Local, seed, CI. Confirm pinned versions against the registry before install. You can open the placeholder and see a live health status. Depends on nothing.
- **Phase 1 — Design system and shell (M).** Tokens, light/dark, app bar, sidebar, tabs, drawer shell, dialogs, palette, `/__design`. You can click through an empty, mock-data workspace in both themes. Depends on 0.
- **Phase 2 — Backend and connection (L).** Sessions, CSRF, credentials, profiles, Connect screen. You can paste `localhost:8000` and land in the workspace. The table list is still empty. Depends on 0 and 1.
- **Phase 3 — Table explorer (M).** Real sidebar, tabs, Overview, read-only Indexes. You can see seed tables and open `orders`. Depends on 2. This completes "see tables".
- **Phase 4 — Items browser (L).** Virtualized grid, scan, filters, selection, read-only JSON preview. You can scroll `orders` and open an item. Depends on 3. This completes the hero journey.
- **Phase 5 — Item editor and CRUD (L).** Typed JSON, Monaco, save, conflict dialog, delete, undo. You can edit a user and undo it. Depends on 4. EDT-7 is attempted only if the phase is green; otherwise it stays on the backlog.
- **Phase 6 — Query and PartiQL (L).** Query builder, generated request, PartiQL with history and saved queries. You can query `orders` by `userId` and run a `SELECT`. Depends on 5.
- **Phase 7 — Table management and import/export (L).** Wizard, GSI/TTL/billing, streaming import and export, clear table. You can create a table, import a CSV, export it, and delete it. Depends on 6.
- **Phase 8 — Polish, hardening, packaging (L).** Palette completion, budgets, security doc, Dockerfile, `npx dynamo-studio`, docs, release candidate. You can run the packed app on one port. Depends on 7.

## 4. Spec coverage matrix

Connection, all Phase 2:

- CON-1, CON-3, CON-5: connect form, Test, smart URL. AC-2.1, AC-2.2.
- CON-2: local, keys, profile, default chain. AC-2.3.
- CON-4: saved profiles, encrypted secrets, 0600. AC-2.6, FR-2.5, FR-2.6.
- CON-6, CON-7: switch, disconnect, status chip, heartbeat. AC-2.8, FR-2.9.
- Read-only flag and server guard. AC-2.4. Secrets and CSRF. AC-2.5, AC-2.7, AC-2.10.

Tables, all Phase 3:

- TBL-1: sidebar search, count, refresh, virtualized long lists. AC-3.1, AC-3.2.
- TBL-2: overview cards, approximate counts, TTL, streams. AC-3.3, AC-3.4, AC-3.8.
- TBL-3: URL tabs, last tab per table, close behavior. AC-3.6, AC-3.7. Transitional polling: AC-3.5.

Items:

- ITM-1, ITM-2, ITM-3, ITM-6, ITM-8: grid, pinned keys, type cells, summary, selection. Phase 4. AC-4.1, AC-4.2, AC-4.6, AC-4.7, AC-4.8, AC-4.9.
- ITM-4: Scan plus the mode control in Phase 4; Query execution in Phase 6. AC-4.5, AC-6.1.
- ITM-5: filter chips, one joiner. Phase 4. AC-4.3, AC-4.4, AC-4.10.
- ITM-7: local sort of loaded scan rows in Phase 4; sort-key order for Query in Phase 6. AC-6.1.

Editor, Phase 5:

- EDT-1, EDT-2, EDT-3: drawer, both JSON modes, validation. AC-5.1, AC-5.3, AC-5.9, AC-5.10.
- EDT-4, EDT-6: create, duplicate, delete, bulk delete, copy, undo. AC-5.2, AC-5.5, AC-5.6, AC-5.7, AC-5.11.
- EDT-5: best-effort hash. AC-5.4.
- Read-only mutations. AC-5.8. Drawer a11y. AC-5.12.
- EDT-7: stretch at the end of Phase 5, otherwise backlog. Recorded in the phase summary.

Query, Phase 6:

- QRY-1, QRY-2: builder and "Show request". AC-6.1, AC-6.2, AC-6.3, AC-6.4.
- QRY-3, QRY-4, QRY-5: PartiQL, history, saved queries, error position. AC-6.5 through AC-6.10.

Management, Phase 7:

- MGT-1, MGT-2, MGT-3: wizard, delete, GSI, TTL, billing, deletion protection. AC-7.1, AC-7.2, AC-7.8.
- MGT-4, MGT-5: export and import. AC-7.3 through AC-7.7, AC-7.9.
- MGT-6: clear table. AC-7.8. Wizard a11y. AC-7.10.

App-wide:

- APP-1, APP-5: theme, density, 1024px layout. Phase 1. AC-1.1 through AC-1.4, AC-1.8. Budgets rechecked in Phase 8. AC-8.3.
- APP-2, APP-3: palette and shortcuts open in Phase 1 (AC-1.5). Actions completed in Phase 8 (FR-8.2, FR-8.3, AC-8.2).
- APP-4: empty, loading, and error from Phase 1 onward. Offline banner and error boundaries in Phase 8. AC-8.1.
- APP-6: About entry in Phase 1. Version and commit hash in Phase 8. FR-8.8.

## 5. Cross-cutting plan

Testing follows `05-quality-and-testing.md`. Unit tests for marshalling, expressions, cursors, and typed JSON come first. Component tests cover keyboard and labels. Integration tests hit DynamoDB Local in Docker. Playwright covers J1–J5, axe in light and dark, and screenshots under `docs/screenshots/phase-N/`. `pnpm verify` includes integration tests, so Docker must be running; without it, `pnpm test:int` exits with a pointer to the README. CI splits verify, integration (DynamoDB Local service), e2e, and build.

Performance is measured at Phase 4 (10k-row scroll) and Phase 8 (initial JS gzip ≤ 250 KB excluding Monaco, FCP, API overhead). Phase 1's tighter 150 KB cap is attempted with tree-shaking. If MUI 9 cannot meet it, the measured size is recorded and the spec is edited in that phase. Monaco is a separate async chunk from Phase 5 on.

Security review runs at the end of Phase 2 and again in Phase 8, using the checklist in `05` section 8, plus `docs/SECURITY.md` in Phase 8. Credentials stay in server memory, encrypted on disk only when Remember is checked, never logged, never returned. The server binds to `127.0.0.1` unless a flag is set. The Phase 8 compose example sets `HOST=0.0.0.0` and keeps the startup warning.

Design review is a light and dark screenshot per new screen, compared with `03-design-system.md`. The `/__design` gallery is the token and state catalog.

## 6. Top 10 risks

1. **Number precision.** `N` stays a string through the API, grid, and editor. Plain JSON uses `lossless-json` only. A 38-digit seed value is an end-to-end assertion (AC-4.8, AC-5.1).
2. **Pagination with filters.** `Limit` counts evaluated items. `fillPage` stops at 2 seconds or 10 calls, whichever comes first, and returns `hasMore`. Cursors are opaque base64url plus a hash of the request shape, per the DynamoDB skill.
3. **MUI and Tailwind.** Layer order is the official MUI 9 + Tailwind 4 recipe. The Phase 1 override test forbids `!important`. Hex colors live in the theme and `tokens.css` only.
4. **Monaco.** Dynamic import on first editor open. Workers configured for Vite and Firefox in Phase 5, rechecked in Phase 8. A textarea fallback exists if the chunk fails. Bundle assertion proves it is not in the initial graph (AC-5.10).
5. **Streaming import memory.** Incremental parsers, 25-item batches, 512 MB cap, progress over NDJSON. AC-7.5 checks that the server does not buffer the file. Cancel aborts the server loop. Error reports live 1 hour and are deleted on shutdown.
6. **Credentials.** Session cookie is httpOnly and SameSite=Strict. Mutations need `X-DS-CSRF`. Profiles use AES-256-GCM, unique IVs, mode 0600. Response tests scan for `secretAccessKey` and `sessionToken`. No STS call. The test response has no `accountId`. Connect attempts are rate limited; the heartbeat is not.
7. **DynamoDB Local versus AWS.** Local accepts dummy keys and is loose about some limits. Integration tests cover happy paths locally. Error mapping is table-tested with SDK-shaped errors. Billing-mode once-per-24h, GSI backfill, and TTL delay are copy and guards, and are not simulated as real AWS. Empty-string keys are rejected by our validator even if Local is lenient.
8. **Lost updates.** Best-effort hash can miss an attribute added between Get and Put. Conflict UI offers Reload and Overwrite and does not call the check atomic. Large items set `details.weakConcurrency`.
9. **Phase 1 bundle.** MUI 9 can blow the 150 KB gzip cap. Mitigation is path imports, one icon style, and no Monaco. Misses become a recorded spec edit, not a silent pass.
10. **PartiQL mutations.** A tokenizer classifies statements so comments and strings cannot hide `DELETE`. Mutations need `X-DS-Confirm: mutation` or the server returns `400 VALIDATION`. Read-only still returns `403 READ_ONLY`. Production requires typed confirmation.

## 7. Definition of Done and the phase loop

A task is done when code, tests, types, lint, keyboard access, labels, light and dark, and empty/loading/error states are done, and the task is checked in the phase file and in `progress.md`. A phase is done when `pnpm verify` is green, every acceptance criterion has a test name or screenshot path, screenshots are in `docs/screenshots/phase-N/`, and no blocking question remains.

Each phase follows `.claude/commands/phase.md` and the spec-driven workflow skill:

1. Orient: constitution, this plan, progress, the phase file, referenced spec sections, git status. Stop if the previous phase is not verified.
2. Clarify: at most five ambiguities, written to `open-questions.md` with a safe default. Ask only if one is blocking.
3. Plan: phase understanding, FR/AC to task map, files, tests to write first, risks, verification. Wait for approval.
4. Implement one task at a time. Tests first for logic. `pnpm typecheck`, `pnpm lint`, and `pnpm test` before the commit. One Conventional Commit per task.
5. Verify: `pnpm verify`, e2e for journeys so far, axe, screenshots.
6. Record evidence, decisions, and a short summary in `progress.md`.
7. Stop and report in this shape: Done, Evidence, Not verified, Open questions, Next. Do not start the next phase.

The end-of-phase report uses the quality-gates format. If Docker or the browser cannot be run, the report names the exact command and does not claim that check passed.

## 8. Spec edits applied

Applied 2026-10-23 and logged in `progress.md`.

- `03-design-system.md`: tabs are Items, PartiQL, Overview, Indexes, with Scan | Query on Items. Snackbar is 4 seconds, or up to 30 seconds while Undo is available. Dark `error-container`, `success-container`, `warning-container`, `text-disabled`, and `warning-text` are named; Phase 1 chooses their hex values. `#F9AB00` stays the fill and the Staging dot. Theme selector is `[data-color-scheme="%s"]`.
- UI skill snackbar bullet matches that 4s / 30s rule.
- `04-api-contract.md`: `GET /connections/:id` returns `{ summary, latencyMs }` from `ListTables` with limit 1. No `accountId` and no STS. One `filterJoiner` for the list; a per-filter joiner is `VALIDATION`. PartiQL mutation without `X-DS-Confirm: mutation` is `400 VALIDATION`. Rate limit is 30 requests per minute per session on `POST /connections/test`, `POST /connections`, and `POST /profiles/:id/connect` only.
- `02-architecture.md`: the client stores the opaque cursor. `fillPage` stops at 2 seconds or 10 calls. `$` key escaping adds one leading `$` on the way out and strips one on the way in. Approved dependencies drop `cmdk`, `notistack`, and `lib-dynamodb`.
- `phases/phase-2-backend-and-connection.md`: a blank endpoint rejects local auth and defaults to the default credential chain. Heartbeat uses `GET /connections/:id` and is not rate limited. One session cookie is shared by every tab.
- `05-quality-and-testing.md`: `edge-cases` includes `address.city = "Pune"` and a 38-digit number. `phases/phase-0-foundation.md`: `pnpm verify` expects Docker, and Phase 0 confirms every pinned version against the registry before install, then records the exact versions in `progress.md`.
- `phases/phase-8-polish-hardening-packaging.md`: versioning is `CHANGELOG.md` plus a semver script. License is MIT.
- `phases/phase-4-items-browser.md`: the Items screen scans the base table; scan `index` stays on the API for tests.
- `phases/phase-7-table-management-import-export.md`: import error reports live one hour and are removed on shutdown.
