# PHASE EXECUTION PROMPT (template)

> Use after the master plan is approved. Start a **fresh session** (`/clear`) per phase.
> Replace `{{N}}` and `{{PHASE_NAME}}`, or just type `/phase N` in Claude Code (same thing).

---

Execute **Phase {{N}}: {{PHASE_NAME}}** of DynamoDB Studio using Spec-Driven Development.

## Context
- Project rules: `AGENTS.md`, `specs/00-constitution.md` (obey strictly).
- Current state: `specs/progress.md` (read first). Phase file: `specs/phases/phase-{{N}}-*.md` (read fully).
- Load skills before working: `spec-driven-workflow`, `quality-gates`, and the ones listed in the phase file header (`dynamodb-expert`, `google-minimal-ui`).
- Other specs: read only the sections the phase file references.

## Process (do not skip steps)
1. **ORIENT**: read the files above; run `git status` and `git log --oneline -10`. If the previous phase is not marked done with `pnpm verify` green, stop and tell me.
2. **CLARIFY**: log ambiguities in `specs/open-questions.md` with safe defaults. Ask me only if BLOCKING.
3. **PLAN (plan mode)**: present (a) your understanding, (b) a coverage matrix mapping every FR and AC in the phase file to tasks, (c) a task breakdown with files to touch and tests to write first, (d) order/dependencies (shared schemas -> server -> web -> e2e), (e) risks, (f) the verification plan. **Wait for my approval.**
4. **IMPLEMENT** (after approval): mirror tasks in the task list; one task in progress at a time. For each task: tests first for logic; component tests for UI behavior; minimal implementation; refactor; run `pnpm typecheck && pnpm lint && pnpm test`; verify UI in light + dark with keyboard; tick the checkbox in the phase file and `specs/progress.md`; commit with Conventional Commits referencing spec IDs.
5. **VERIFY**: `pnpm verify`; e2e for the phase; axe scans (0 serious/critical) in both themes; screenshots into `docs/screenshots/phase-{{N}}/`; evidence for every AC.
6. **RECORD**: update `specs/progress.md` (status, AC evidence, decisions, spec changes, metrics, 5-10 line summary).
7. **STOP**: do not begin the next phase.

## Guardrails
- Build only what the phase file specifies. New ideas go to `specs/backlog.md`.
- If spec and reality disagree, fix the spec first with a logged note, then code.
- No `any`, no `console.*`, no `!important`, no hex colors outside theme tokens, no secrets in logs/responses.
- Never weaken tests or lint rules to get green. Fix root causes. If a fix fails twice, stop and diagnose.
- Be honest: if something could not be run or verified, say so and give me the exact command.

## Final report format
```
Done: ...
Evidence: commands + results; AC ids -> test/screenshot paths
Not verified: ... (with exact commands for me)
Open questions: ...
Next: /phase {{N+1}}
```
