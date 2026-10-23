# Progress Tracker

> The agent updates this file at the end of every task and phase. It is the memory between sessions.
> Format for evidence: `AC-3.2 ✔ apps/web/src/features/tables/SidebarTableList.test.tsx > "filters as you type"`

**Current phase:** 2 (in progress)
**Last updated:** 2026-10-23

## Phase status
| Phase | Name | Status | Verify green | Date |
|---|---|---|---|---|
| 0 | Foundation | ✅ done | ✅ | 2026-10-23 |
| 1 | Design system & app shell | ✅ done | ✅ | 2026-10-23 |
| 2 | Backend & connection | in progress | ☐ | |
| 3 | Table explorer | ☐ not started | ☐ | |
| 4 | Items browser | ☐ not started | ☐ | |
| 5 | Item editor & CRUD | ☐ not started | ☐ | |
| 6 | Query builder & PartiQL | ☐ not started | ☐ | |
| 7 | Table management & import/export | ☐ not started | ☐ | |
| 8 | Polish, hardening, packaging | ☐ not started | ☐ | |

## Phase 2 tasks
- [x] T2.1 Shared schemas
- [x] T2.2 Security plugin
- [x] T2.3 ErrorMapper
- [x] T2.4 Endpoint normalizer
- [x] T2.5 ConnectionManager and routes
- [x] T2.6 ProfileStore
- [ ] T2.7 Read-only guard
- [ ] T2.8 Web API client
- [x] T2.9 URL parsing util
- [ ] T2.10 Connect card
- [ ] T2.11 Saved connections
- [ ] T2.12 Workspace guard and heartbeat
- [ ] T2.13 Playwright
- [ ] T2.14 Security checklist
- [ ] T2.15 Progress summary

## Acceptance criteria evidence

- AC-0.1 ✔ `pnpm verify` on 2026-10-23 with DynamoDB Local up: lint, typecheck, 14 unit tests, 2 integration tests, production build. Web JavaScript gzip 100585 bytes (budget 256000).
- AC-0.2 ✔ Phase 0 screenshots remain at `docs/screenshots/phase-0/placeholder-light.png` and `docs/screenshots/phase-0/placeholder-dark.png`. Phase 1 replaced that smoke test with `e2e/smoke.spec.ts` > "connect placeholder shows DynamoDB Studio", which still fails on serious or critical axe violations and does not overwrite the phase-0 images.
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

Monaco stays out until Phase 5.

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
  - Planning observed `@mui/material` 9.4.0 and `tailwindcss` 4.3 on 2026-10-23. Phase 1 installed 9.5.0 and 4.3.3.
- 2026-10-23 — Phase 1 contrast and shell defaults.
  - Light `primary` is `#1967D2`. `#1A73E8` is 4.27:1 on `bg` and 3.93:1 on `primary-container`, so text buttons, tabs, and the selected row failed axe. The Dev dot stays `#1A73E8`.
  - Light `text-disabled` is `#727272`. Dark containers are `#5C2B29`, `#16352A`, and `#3E2E00`. Dark `warning-text` is `#F6C343`.
  - Density is Comfortable (48px) or Compact (32px) in the overflow menu and sets `--row-height`.
  - `/__design` is registered only when `import.meta.env.DEV` is true. `scripts/check-design-bundle.ts` fails the production build if `/__design`, `Design gallery`, or `DesignGallery` appears in `apps/web/dist`.

## Constitution changes
(none)

## Phase summaries

### Phase 0 — Foundation (2026-10-23)

Shipped a pnpm workspace (`apps/web`, `apps/server`, `packages/shared`) where `pnpm dev` shows an unthemed placeholder that reads `GET /api/v1/health` through the Vite proxy. `HealthResponse` is the only shared Zod schema. DynamoDB Local runs `-sharedDb -inMemory` on port 8000. `pnpm dev:db` starts it and `pnpm seed` loads users (1000), orders (10000), sessions, and edge-cases, including `address.city = "Pune"` and a 38-digit number. `pnpm verify` is green with Docker running. The placeholder has no MUI theme, so the dark screenshot is the same page under `prefers-color-scheme: dark`. `actionlint` was not installed, so CI workflow lint is still open. Q-001 through Q-005 stay open with the defaults used here.

### Phase 1 — Design system and app shell (2026-10-23)

The shell is MUI 9 plus Tailwind 4, with light, dark, and system themes. An inline script sets `data-color-scheme` from `mui-mode` before React, and a throttled Playwright reload never observed a light scheme when dark was stored. The workspace is mock data: app bar, filterable sidebar that collapses to a 72px rail, URL tabs, and a focus-trapped drawer that resizes from 420 to 720. Comfortable and Compact live in the overflow menu and set `--row-height` to 48px or 32px. `/` is a wordmark, theme toggle, and Connect button. `/__design` exists only in dev; the production build rejects the gallery string and measured 201611 bytes of JavaScript gzip, which is over the 150 KB attempt and under the 250 KB Phase 8 budget. Q-006, Q-007, Q-008, and Q-010 stay open on the defaults used here. Q-009 is resolved by the recorded bundle size. Next command, when you want it, is `/phase 2`.

## Metrics log

- 2026-10-23 — Phase 0 web JavaScript gzip: 100585 bytes. Budget 256000.
- 2026-10-23 — Phase 1 web JavaScript gzip: 201611 bytes (one chunk, `apps/web/dist/assets/index-*.js`). Attempted budget 153600. Phase 8 budget 256000. CSS gzip 21.19 KB is not in the JS number. Machine: local Darwin, Node 26.4.0. No 10k-row fps or API overhead yet.
