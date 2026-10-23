# Progress Tracker

> The agent updates this file at the end of every task and phase. It is the memory between sessions.
> Format for evidence: `AC-3.2 ✔ apps/web/src/features/tables/SidebarTableList.test.tsx > "filters as you type"`

**Current phase:** 0 (done)
**Last updated:** 2026-10-23

## Phase status
| Phase | Name | Status | Verify green | Date |
|---|---|---|---|---|
| 0 | Foundation | ✅ done | ✅ | 2026-10-23 |
| 1 | Design system & app shell | ☐ not started | ☐ | |
| 2 | Backend & connection | ☐ not started | ☐ | |
| 3 | Table explorer | ☐ not started | ☐ | |
| 4 | Items browser | ☐ not started | ☐ | |
| 5 | Item editor & CRUD | ☐ not started | ☐ | |
| 6 | Query builder & PartiQL | ☐ not started | ☐ | |
| 7 | Table management & import/export | ☐ not started | ☐ | |
| 8 | Polish, hardening, packaging | ☐ not started | ☐ | |

## Acceptance criteria evidence

- AC-0.1 ✔ `pnpm verify` on 2026-10-23 with DynamoDB Local up: lint, typecheck, 14 unit tests, 2 integration tests, production build. Web JavaScript gzip 100585 bytes (budget 256000).
- AC-0.2 ✔ `e2e/smoke.spec.ts` > "placeholder shows DynamoDB Studio and the health status". Screenshots: `docs/screenshots/phase-0/placeholder-light.png`, `docs/screenshots/phase-0/placeholder-dark.png`. Axe serious and critical violations fail that test.
- AC-0.3 ✔ `scripts/seed.int.test.ts` > "creates users(1000), orders(10000), sessions, and edge-cases". `pnpm seed` completed in 1502ms.
- AC-0.4 ✔ `apps/server/src/routes/health.ts` and `apps/web/src/app/fetch-health.ts` import `@dynamo-studio/shared`.
- AC-0.5 ✔ `.husky/commit-msg` rejects `bad message` (exit 1) and accepts `chore: test` (exit 0).
- AC-0.6 ◻ `actionlint` is not on PATH, so the workflow was not linted. Command left: `actionlint .github/workflows/ci.yml`. The workflow is `.github/workflows/ci.yml` with jobs `verify`, `integration`, `e2e`, and `build`.
- AC-0.7 ✔ `pnpm lint` is green. `eslint.config.js` sets `@typescript-eslint/no-explicit-any` and `no-console` to error.

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

Not installed in Phase 0 (Q-004). Phase 1 rechecks the registry before adding them: `@mui/material`, `tailwindcss`, Monaco, Zustand, React Router. Planning had observed `@mui/material` 9.4.0 and `tailwindcss` 4.3; those numbers are not pins.

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
  - Import error reports live 1 hour and are deleted on shutdown.
  - Palette and snackbars use MUI. The product path does not add `lib-dynamodb`, `cmdk`, or `notistack`.
  - License is MIT. Phase 8 versioning is `CHANGELOG.md` plus a semver script.
  - Dark container, `text-disabled`, and `warning-text` hex values are chosen in Phase 1 by the contrast test, then written into `03-design-system.md`. `#F9AB00` is a fill and the Staging dot.
  - MUI color scheme selector is `[data-color-scheme="%s"]`, set by an inline script before React mounts.
  - Planning observed `@mui/material` 9.4.0 and `tailwindcss` 4.3 on 2026-10-23. Phase 0 did not install them. Exact installed versions are in the pinned-versions section above.

## Constitution changes
(none)

## Phase summaries

### Phase 0 — Foundation (2026-10-23)

Shipped a pnpm workspace (`apps/web`, `apps/server`, `packages/shared`) where `pnpm dev` shows an unthemed placeholder that reads `GET /api/v1/health` through the Vite proxy. `HealthResponse` is the only shared Zod schema. DynamoDB Local runs `-sharedDb -inMemory` on port 8000. `pnpm dev:db` starts it and `pnpm seed` loads users (1000), orders (10000), sessions, and edge-cases, including `address.city = "Pune"` and a 38-digit number. `pnpm verify` is green with Docker running. The placeholder has no MUI theme, so the dark screenshot is the same page under `prefers-color-scheme: dark`. `actionlint` was not installed, so CI workflow lint is still open. Q-001 through Q-005 stay open with the defaults used here. Next command, when you want it, is `/phase 1`. Phase 1 must recheck MUI and Tailwind before installing them.

## Metrics log
(Phase 4 and Phase 8: bundle size, grid fps, API overhead)
