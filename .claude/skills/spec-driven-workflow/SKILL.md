---
name: spec-driven-workflow
description: The Spec-Driven Development loop for DynamoDB Studio. Use at the start of any phase or task, when planning, when a requirement is ambiguous, when about to commit, and when closing a phase. Enforces read-specs, plan, tasks, test-first, verify, record.
---

# Spec-Driven Workflow

You work from specs, not from imagination. The loop never changes:

```
ORIENT -> CLARIFY -> PLAN -> TASKS -> IMPLEMENT (small, test-first) -> VERIFY -> RECORD -> STOP
```

## 1. ORIENT (always first)
1. Read `specs/00-constitution.md` (skim if you have read it this session; re-read Articles III, IV, VI for risky work).
2. Read `specs/progress.md`: find the current phase and unfinished tasks.
3. Read the full current phase file `specs/phases/phase-N-*.md`.
4. Read only the sections of other specs that the phase file references.
5. Run `git status` and `git log --oneline -10`. Confirm the repo is clean or understand why not.
6. Confirm previous phase is marked done with `pnpm verify` green. If not, **stop and report**; do not build on a broken base.

## 2. CLARIFY
- List ambiguities (max 5). For each: write to `specs/open-questions.md` with the default you will choose (safest, simplest, reversible).
- Ask the user **only** if an item is truly blocking (it changes data safety, security, or the architecture). Otherwise proceed with defaults.
- Never silently expand scope. New idea -> `specs/backlog.md`.

## 3. PLAN (plan mode)
Produce a plan containing:
1. **Understanding**: 3-5 bullets restating the phase goal in your words.
2. **Spec coverage matrix**: each FR/AC from the phase file -> which task covers it.
3. **Task list**: reuse the phase file's `T-` tasks; split any task larger than ~half a day into sub-tasks. Each sub-task: goal, files touched (paths), tests to write first, risks.
4. **Order and dependencies**: shared schemas -> server -> web -> e2e. Pure logic before UI.
5. **Risks and unknowns**: with mitigation.
6. **Verification plan**: exact commands, plus which screenshots/tests prove each AC.
Wait for approval before writing code (unless the user said to proceed).

## 4. TASKS
- Mirror tasks in the task list tool (one `in_progress` at a time).
- Keep each task shippable: it compiles, tests pass, UI isn't half-broken.

## 5. IMPLEMENT
Per task:
1. **Write tests first** for logic. For UI: write the component test describing behavior (roles, labels, keyboard) first when practical.
2. Implement the minimum to pass.
3. Refactor; keep files small; respect folder conventions from `02-architecture.md`.
4. Run `pnpm typecheck && pnpm lint && pnpm test` (scope with filters while iterating: `pnpm --filter @dynamo-studio/web test -- <pattern>`).
5. For UI: open the app, check light + dark, keyboard path, empty/loading/error states.
6. Tick the task in the phase file's checklist (`[x]`) **and** in `specs/progress.md`.
7. Commit: `type(scope): imperative summary` (types: feat, fix, test, refactor, chore, docs, perf; scopes: web, server, shared, e2e, specs, repo). Body explains why; mention spec IDs (e.g. `Refs FR-4.6`).

## 6. VERIFY (see quality-gates skill)
- Run `pnpm verify`.
- Walk the acceptance criteria one by one; for each, run/inspect the evidence. If an AC lacks evidence, add the missing test.
- Take light/dark screenshots into `docs/screenshots/phase-N/`.

## 7. RECORD
In `specs/progress.md`:
- Phase table row -> status, verify green, date.
- AC evidence lines (`AC-4.3 ✔ path > test name`).
- Decisions/spec changes made (and why).
- 5-10 line phase summary: shipped, cut, known issues, heads-up for next phase.
- Metrics (when the phase says so).

## 8. STOP
End your turn with a brief report: what shipped, evidence, open questions, suggested next command (`/phase N+1`). **Do not start the next phase.**

## Rules of engagement
- Spec conflicts with reality? Fix the spec first (small edit + log), then code.
- Constitution conflicts with a task? The constitution wins; log it in open-questions.
- Don't refactor unrelated code. Don't reformat files you aren't changing.
- If a command fails twice for the same reason, stop and diagnose root cause; do not loop.
- If you cannot run something (no Docker, no browser), say so plainly and provide the exact commands for the user; never claim it passed.
- Prefer deleting code to adding code. Prefer standard platform/library features to custom ones.
- Never mark an AC done without evidence.

## Templates

**Commit message**
```
feat(server): add scan with fillPage budget

Loop until pageSize items or 2s/10 calls; return partial with hasMore.
Refs FR-4.3, AC-4.5
```

**Open question entry**
```
- [Q-007] Should Plain JSON show numbers as JS numbers when safe? Default: always lossless text. (Phase 5, 2026-10-24)
```

**Phase summary**
```
### Phase 4 summary (2026-10-30)
Shipped: virtualized grid, type-aware cells, filters, selection, column chooser.
Cut: column reordering (backlog). Known issue: Safari header sticky jitter (Q-012).
Metrics: 10k rows scroll 58fps; initial JS 212KB gz.
Heads-up Phase 5: drawer must reuse CellRenderer's TypeBadge.
```
