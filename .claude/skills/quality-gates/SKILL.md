---
name: quality-gates
description: Verification gates for DynamoDB Studio. Use before claiming a task or phase is done, when reviewing, when tests/lint/typecheck fail, and when auditing acceptance criteria, accessibility, performance, or security. Defines exact commands, evidence rules, and honest reporting.
---

# Quality Gates

"Done" is a claim that needs evidence. This skill defines the evidence.

## 1. Task gate (run before every commit)
```
pnpm typecheck
pnpm lint
pnpm test            # scope while iterating, full before commit
```
Plus, depending on the task:
- Server routes/services -> `pnpm test:int` (DynamoDB Local must be running: `pnpm dev:db`)
- UI behavior -> component tests + manual check in light & dark + keyboard path
- User journeys -> `pnpm test:e2e -- <spec>`

## 2. Phase gate (run before declaring a phase finished)
1. `pnpm verify` (lint, typecheck, unit, integration, build) -> must be green on a clean install (`rm -rf node_modules && pnpm install --frozen-lockfile` at least once per phase).
2. `pnpm test:e2e` for all journeys touched so far.
3. Walk every **AC-x.y** in the phase file. For each: run the named test or take the named screenshot; record evidence in `specs/progress.md`. Missing evidence -> write the test now.
4. Accessibility: axe scan (Playwright) for each new route/state in light + dark -> 0 serious/critical. Keyboard-only walkthrough of new flows.
5. Screenshots: `docs/screenshots/phase-N/<screen>-<light|dark>.png`.
6. Performance (when the phase says so): measure and record. Budgets in `05-quality-and-testing.md` section 3.
7. Spec reconciliation: diff behavior vs spec; update spec or code; log in progress.
8. `specs/open-questions.md`: no BLOCKING items.

## 3. Review checklist (self-review of your diff)
**Correctness**
- [ ] Types preserved (no number coercion, sets/binary intact)
- [ ] Expressions use placeholders only; no interpolation
- [ ] Pagination handled; `hasMore` honest; cursors validated
- [ ] Errors mapped to stable codes; UI shows friendly copy + Details
- [ ] Abort/cancel wired (client signal -> server stops work)

**Safety/Security**
- [ ] Mutations pass the read-only guard on the server
- [ ] Destructive flows confirm (typed for production/large)
- [ ] No secrets in logs/responses/storage/URLs; redaction tests exist
- [ ] Inputs validated with strict Zod schemas and size limits

**UI/UX**
- [ ] Matches `03-design-system.md`; one primary action; tokens only
- [ ] Loading, empty, error, success states exist
- [ ] Light and dark verified; reduced motion respected
- [ ] Keyboard + screen reader semantics; focus management

**Maintainability**
- [ ] Small files, clear names, no dead code/console/TODO
- [ ] Tests meaningful (behavior, not implementation); no flaky waits (use `findBy*`/`expect.poll`, never fixed sleeps)
- [ ] Dependency additions justified

## 4. Debugging discipline
- Reproduce first with a failing test. Fix root cause. Keep the test.
- If the same fix fails twice, stop, state hypotheses, gather evidence (logs, minimal repro) before another attempt.
- Flaky test? Find the race; do not add retries or sleeps as the fix.
- Never weaken a test or lint rule to get green. If a rule is wrong, change it deliberately with a reason in the commit.

## 5. Accessibility procedure
1. `@axe-core/playwright` scan per route/state in both color schemes; fail on serious/critical.
2. Keyboard audit: Tab through; verify visible focus, logical order, no traps (except dialogs/drawers), Esc behavior, focus return.
3. Zoom to 200% at 1280px: no loss of function, no horizontal scroll for primary content.
4. Contrast: run the token contrast test; spot check states (disabled, hover, selected) with a contrast tool.
5. Screen reader notes: verify names/roles/states for grid, dialogs, tabs, comboboxes, live regions (document in `docs/a11y-notes.md`).

## 6. Performance procedure
- Bundle: `pnpm --filter @dynamo-studio/web build` then analyze (visualizer); confirm Monaco is a separate async chunk; initial gz size <= budget.
- Grid: Playwright with CPU throttle 4x, programmatic scroll 10,000 rows; record frames via `performance` API / tracing; target >= 55 fps on baseline machine, else profile (React Profiler, `why-did-you-render` in dev only).
- Server: autocannon or simple benchmark on `/scan` against DynamoDB Local; overhead p95 < 20ms.
- Record numbers in `specs/progress.md` metrics log with date and machine notes.

## 7. Security procedure
Run the checklist in `05-quality-and-testing.md` section 8. Additionally:
- `pnpm audit --prod`; resolve high/critical or document.
- Grep tests ensure `secretAccessKey`/`sessionToken` never appear in any response body or log line.
- Verify server refuses non-`http(s)` endpoints, bad Origin/Host, missing CSRF.
- Verify profile file mode 0600 and encryption at rest.

## 8. Reporting format (end of every task/phase message)
```
Done: <what shipped, 1-3 lines>
Evidence: <commands run + results; AC ids with test/screenshot paths>
Not verified: <anything you could not run and why + exact command for the user>
Open questions: <ids or none>
Next: <suggested command>
```
Be honest. If something is unverified, say so. Never write "should work".
