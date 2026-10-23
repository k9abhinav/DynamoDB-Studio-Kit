# REVIEW AND FIX PROMPTS (copy what you need)

Each prompt is self-contained. Prefix with "Load the relevant skills first." when using Codex.

---

## P-DESIGN: Design polish audit
Audit the UI against `specs/03-design-system.md` and the `google-minimal-ui` skill. Run the app and Playwright; screenshot every screen and state (loading, empty, error, success) in **light and dark** at 1280px and 1024px widths. Produce a table: Screen | Issue | Severity (high/med/low) | Spec reference | Fix. Check: one primary action per view, tokens only (no hex/inline styles/`!important`), borders over shadows, pill primary buttons, sentence case, spacing on the 4px grid, focus ring, dark-mode parity, truncation + tooltips, copy quality. Then fix all high and medium issues, one commit per screen, and re-screenshot to `docs/screenshots/polish/`. Do not add features.

## P-A11Y: Accessibility sweep
Run axe (Playwright) on every route and key state (dialogs, drawer, wizard steps, grid) in both themes. Then do a keyboard-only audit of the J1-J5 journeys: visible focus, logical order, Esc behavior, focus return, no traps. Verify names/roles/states for grid, tabs, comboboxes, dialogs, live regions. Fix every serious/critical violation and every keyboard blocker; add regression tests. Write findings and manual-check notes to `docs/a11y-notes.md`.

## P-SECURITY: Security review
Execute the checklist in `specs/05-quality-and-testing.md` section 8 and the Security procedure in the `quality-gates` skill. Write tests that prove: no secrets in any response/log/URL/storage; CSRF and Origin/Host enforcement; read-only enforced on **every** mutating route (including PartiQL, import, clear, table ops); Zod `.strict()` on inputs; expression injection impossible; profile store `0600` + encrypted. List residual risks honestly. Output `docs/SECURITY.md` and fix all findings.

## P-PERF: Performance audit
Measure and report vs budgets in `specs/05-quality-and-testing.md` section 3: initial JS (gz), Monaco lazy chunk, FCP on connect, grid scroll fps at 10k rows (4x CPU throttle), drawer open time, server overhead p95. Profile regressions (React Profiler, bundle visualizer), fix the top offenders (memoization, virtualization, code splitting, selector granularity), and re-measure. Record in `specs/progress.md` metrics log.

## P-CORRECTNESS: DynamoDB correctness audit
Using the `dynamodb-expert` skill, audit: typed-JSON round trips (property tests), number precision (38 digits, exponents), sets/binary handling, expression builder (placeholders only; all used; nested paths; key-condition rules), pagination (fillPage, cursors with ctx hash), batch retry/backoff, error mapping table, read-only guard coverage. Write failing tests for any gap first, then fix.

## P-BUG: Bug fix (fill in)
Bug: `<describe expected vs actual, steps, environment, screenshots/logs>`.
Process: (1) reproduce with a failing test (unit/integration/e2e as appropriate); (2) find root cause, stating hypotheses and evidence; (3) minimal fix; (4) confirm the test passes and `pnpm verify` is green; (5) check for the same defect pattern elsewhere; (6) update specs if the spec was wrong; (7) commit `fix(scope): ...` with a body explaining root cause. Do not refactor unrelated code.

## P-SPEC-DRIFT: Reconcile code and specs
Compare the implemented behavior with `specs/` for the phases completed so far. List every divergence (spec says X, code does Y), decide per item whether to fix the code or amend the spec (justify), apply changes, log them in `specs/progress.md` under "Decisions & spec changes", and ensure tests reflect the final truth.

## P-NEXT-PHASE-BRIEF: Pre-flight for a phase
Read `specs/progress.md` and `specs/phases/phase-N-*.md`. Without changing files, give me: (1) prerequisites that must already exist, and whether they do (check the repo), (2) the 5 riskiest tasks and why, (3) questions I should answer before you start, (4) a one-screen summary of what I will be able to see and try at the end of the phase.

## P-RESUME: Resume after interruption
Read `specs/progress.md`, `git log --oneline -20`, `git status`, and the current phase file. Tell me exactly where we stopped (last completed task, any uncommitted or half-done work), whether `pnpm verify` is green right now, and propose the next 3 tasks. Wait for my go-ahead.

## P-DEMO: Demo script
Write `docs/DEMO.md`: a 3-minute scripted walkthrough using the seed data (connect to DynamoDB Local, browse `orders`, filter, query by key, edit an item with undo, run PartiQL, export, switch theme, command palette). Include exact clicks/keys and expected results. Verify each step by running it with Playwright and capture screenshots.
