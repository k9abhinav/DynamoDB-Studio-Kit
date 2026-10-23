---
description: Run the full spec-driven loop for one phase (usage: /phase 3)
argument-hint: <phase number 0-8>
---

Execute **Phase $ARGUMENTS** of DynamoDB Studio using the spec-driven workflow.

1. Load skills: `spec-driven-workflow`, `quality-gates`, plus `dynamodb-expert` and `google-minimal-ui` as the phase file's header says.
2. ORIENT: read `specs/00-constitution.md`, `specs/progress.md`, and `specs/phases/phase-$ARGUMENTS-*.md` in full, then only the spec sections that phase file references. Check `git status`. Confirm the previous phase is marked done and `pnpm verify` was green; if not, stop and tell me.
3. CLARIFY: log ambiguities in `specs/open-questions.md` with safe defaults. Ask me only about BLOCKING ones.
4. PLAN: enter plan mode and present: understanding, spec coverage matrix (every FR/AC -> task), task breakdown with files and tests-first notes, order/dependencies, risks, verification plan. Wait for my approval.
5. After approval: mirror tasks in the task list, implement task by task (tests first for logic, component tests for UI), tick checkboxes in the phase file and `specs/progress.md`, commit per task with Conventional Commits.
6. VERIFY with the phase gate from the `quality-gates` skill: `pnpm verify`, e2e, axe, light/dark screenshots to `docs/screenshots/phase-$ARGUMENTS/`, evidence for every AC.
7. RECORD in `specs/progress.md` (status, evidence, decisions, summary, metrics).
8. STOP and give the report in the quality-gates reporting format. Do not start the next phase.
