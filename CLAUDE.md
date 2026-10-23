# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- **Always start in plan mode for a new phase.** Produce a short plan (tasks, files, risks), wait for approval, then implement.
- Skills live in `.claude/skills/*/SKILL.md`. Load the relevant one before working (see table in AGENTS.md). Do this proactively, not only when asked.
- Slash commands: `/phase <n>` runs the full spec-driven loop for a phase. `/verify` runs the quality gates and audits acceptance criteria.
- Use subagents for read-heavy research (e.g. "Explore" to find all usages of a type) so the main context stays clean. Do not use subagents to write code in parallel on the same files.
- Use the task list (TaskCreate/TaskUpdate) to mirror the phase task checklist. Keep exactly one task `in_progress`.
- Prefer `Edit` over rewriting whole files. Run `pnpm typecheck` after any shared-type change.
- When a UI change is made, run the app or Playwright and look at a screenshot in light and dark before claiming it matches the design system.
- Keep this file short. Put new durable rules in `specs/00-constitution.md`, not here.
