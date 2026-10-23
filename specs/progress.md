# Progress Tracker

> The agent updates this file at the end of every task and phase. It is the memory between sessions.
> Format for evidence: `AC-3.2 ✔ apps/web/src/features/tables/SidebarTableList.test.tsx > "filters as you type"`

**Current phase:** 0 (not started)
**Last updated:** 2026-10-23

## Phase status
| Phase | Name | Status | Verify green | Date |
|---|---|---|---|---|
| 0 | Foundation | ☐ not started | ☐ | |
| 1 | Design system & app shell | ☐ not started | ☐ | |
| 2 | Backend & connection | ☐ not started | ☐ | |
| 3 | Table explorer | ☐ not started | ☐ | |
| 4 | Items browser | ☐ not started | ☐ | |
| 5 | Item editor & CRUD | ☐ not started | ☐ | |
| 6 | Query builder & PartiQL | ☐ not started | ☐ | |
| 7 | Table management & import/export | ☐ not started | ☐ | |
| 8 | Polish, hardening, packaging | ☐ not started | ☐ | |

## Acceptance criteria evidence
(Agent appends per phase: AC id, ✔/✘, evidence path)

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
  - Planning observed `@mui/material` 9.4.0 and `tailwindcss` 4.3 on 2026-10-23. Phase 0 rechecks the registry and replaces this note with the exact installed versions.

## Constitution changes
(none)

## Phase summaries
(Agent writes 5-10 lines per finished phase: what shipped, what was cut, known issues, next-phase heads-up)

## Metrics log
(Phase 4 and Phase 8: bundle size, grid fps, API overhead)
