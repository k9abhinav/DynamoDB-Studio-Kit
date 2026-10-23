# 05. Quality and Testing

## 1. Test pyramid
| Layer | Tooling | What | Target |
|---|---|---|---|
| Unit | Vitest | marshalling, typed-JSON, expression builder, error mapper, cursor codec, retry/backoff, CSV/NDJSON parsers | >= 90% lines in `packages/shared` and `apps/server/src/dynamo` |
| Component | Vitest + Testing Library + MSW | forms, grid behaviors, drawer/editor, dialogs, filters | every interactive component has tests for happy path, validation, keyboard |
| Integration (server) | Vitest + **DynamoDB Local** (Docker) | each route end-to-end against a real DynamoDB API: pagination, filters, GSI queries, batch delete, import/export, PartiQL, read-only, errors | every endpoint in `04-api-contract.md` |
| E2E | Playwright | J1-J5 journeys, light + dark screenshots, keyboard-only run | all hero journeys green in CI |
| A11y | axe-core in Playwright + eslint-plugin-jsx-a11y | every route/state | 0 serious/critical |
| Property-based | fast-check (dev dep allowed) | typed-JSON round trip, cursor codec | required for typed-JSON |

## 2. Test data
- `scripts/seed-data.ts` seeds DynamoDB Local with: `users` (PK `id`, 1,000 items, GSI `email-index`), `orders` (PK `userId`, SK `createdAt`, 10,000 items, GSI `status-createdAt-index`), `sessions` (TTL attr), `edge-cases` (a 38-digit number, an item whose `address.city` is `"Pune"`, sets, binary, nested maps/lists, empty strings, unicode, 390 KB item).
- Seed is idempotent and fast (< 15s).

## 3. Performance budgets
| Metric | Budget |
|---|---|
| Initial JS (gzip, excluding Monaco) | <= 250 KB |
| Monaco | lazy only, never in initial bundle |
| First contentful paint on connect screen (local) | < 1.0 s |
| Table list render for 1,000 tables | < 100 ms interaction (virtualized) |
| Grid with 10,000 loaded rows | scrolling >= 55 fps, no layout thrash |
| Open item drawer | < 150 ms (excluding Monaco first load) |
| API overhead (server, excl. AWS latency) | < 20 ms p95 |

Record measurements in `specs/progress.md` at Phase 4 and Phase 8.

## 4. Static quality gates
- `pnpm lint` (ESLint flat config incl. `react-hooks`, `jsx-a11y`, `@typescript-eslint/strict-type-checked`), `pnpm typecheck` (all packages, `strict`, `noUncheckedIndexedAccess`), Prettier check.
- No `any`, no `eslint-disable` without a reason comment, no `console.*`, no TODO without an `open-questions.md` or backlog reference.
- Bundle analyzer report in Phase 8.

## 5. CI (GitHub Actions: `.github/workflows/ci.yml`)
Jobs: `verify` (install, lint, typecheck, unit/component), `integration` (service container `amazon/dynamodb-local`, run seed + `test:int`), `e2e` (Playwright with browsers cached, upload screenshots and traces on failure), `build` (production build + size check).

## 6. Definition of Done (task)
- [ ] Code implemented per spec IDs listed in the task
- [ ] Tests written first for logic, and added for UI
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green locally
- [ ] Works in light and dark; keyboard-only path verified; labels/roles present
- [ ] Loading, empty, error states implemented and visible
- [ ] No new dependency without justification
- [ ] Task ticked in `specs/progress.md`; Conventional Commit made

## 7. Definition of Done (phase)
- [ ] All tasks done
- [ ] `pnpm verify` green; integration + e2e for the phase green
- [ ] Every acceptance criterion (AC) in the phase file ticked **with evidence** (test name or screenshot path) in `specs/progress.md`
- [ ] Screenshots (light + dark) of new screens saved to `docs/screenshots/phase-N/`
- [ ] Spec drift reconciled (specs updated if reality changed)
- [ ] `specs/open-questions.md` reviewed; no BLOCKING items left
- [ ] Short phase summary written in `specs/progress.md`

## 8. Security review checklist (run in Phase 2 and again in Phase 8)
- [ ] Secrets never in responses, logs, URLs, localStorage, error messages
- [ ] Cookie: httpOnly, SameSite=Strict; CSRF header enforced on mutations
- [ ] Origin + Host checks (DNS rebinding defense); default bind 127.0.0.1
- [ ] Read-only enforced server-side on every mutating route including PartiQL and import/clear
- [ ] Zod `.strict()` on all inputs; size limits; rate limit on `/connections*`
- [ ] No user text interpolated into expressions; reserved words handled
- [ ] SSRF consideration documented: endpoint URL is user-chosen by design; server is local; warn when binding non-loopback; block `file:`, only allow `http:`/`https:`
- [ ] Profile store file mode 0600; key never leaves disk; documented threat model
- [ ] Dependencies audited (`pnpm audit`), lockfile committed
