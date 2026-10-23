# CODEX PROMPTS

Codex reads `AGENTS.md` automatically. The skills are plain Markdown, so the prompts below tell Codex to read them explicitly.

---

## A. Planning run (paste first, read-only / suggest mode)

You are the lead engineer for **DynamoDB Studio** (React 19 + MUI + Tailwind v4 frontend, Node/Fastify + AWS SDK v3 backend, pnpm monorepo). This repository contains a complete Spec-Driven Development kit. **Do not write code or modify files in this run.**

Read, in order: `AGENTS.md`, `specs/00-constitution.md`, `specs/01-product-spec.md`, `specs/02-architecture.md`, `specs/03-design-system.md`, `specs/04-api-contract.md`, `specs/05-quality-and-testing.md`, `specs/progress.md`, every file in `specs/phases/`, and the four skill files at `.claude/skills/spec-driven-workflow/SKILL.md`, `.claude/skills/dynamodb-expert/SKILL.md`, `.claude/skills/google-minimal-ui/SKILL.md`, `.claude/skills/quality-gates/SKILL.md`.

Then respond with:
1. A skeptical review of the specs (contradictions, gaps, risky assumptions) citing file and section.
2. Up to 7 clarifying questions with recommended defaults (mark BLOCKING ones).
3. After my answers: a master plan covering the phase roadmap (0-8), spec coverage matrix (every feature ID to phase + ACs), cross-cutting testing/CI/perf/security plan, top 10 risks with mitigations, and any proposed spec edits.

Stop after the plan and wait for me to say "Start Phase 0".

---

## B. Phase run (paste per phase; use a fresh session each time)

Execute **Phase N** of DynamoDB Studio. Follow `AGENTS.md` and the constitution strictly.

1. Read `specs/progress.md` and `specs/phases/phase-N-*.md` fully. Read `.claude/skills/spec-driven-workflow/SKILL.md` and `.claude/skills/quality-gates/SKILL.md`, plus the other skills named in the phase file header. Read only the spec sections the phase references.
2. Run `git status` / `git log --oneline -10`. If the previous phase isn't complete with `pnpm verify` green, stop and tell me.
3. Present a plan: understanding, coverage matrix (each FR/AC to tasks), tasks with files and tests-first notes, order, risks, verification plan. **Wait for my approval before changing files.**
4. After approval implement task by task: tests first for logic, component tests for UI, minimal code, `pnpm typecheck && pnpm lint && pnpm test` before each commit, Conventional Commits referencing spec IDs, tick checkboxes in the phase file and `specs/progress.md`.
5. Verify: `pnpm verify`, e2e, axe (0 serious/critical, light and dark), screenshots to `docs/screenshots/phase-N/`, evidence for every AC.
6. Update `specs/progress.md` (status, evidence, decisions, metrics, short summary).
7. Stop. Report as: Done / Evidence / Not verified (with exact commands) / Open questions / Next.

Rules: build only what the phase specifies (ideas go to `specs/backlog.md`); no `any`, `console.*`, `!important`, or hard-coded colors; secrets never in logs or responses; never weaken tests to pass; if you can't run something, say so.

---

## C. Suggested Codex settings
- Approval mode: require approval for shell commands that install packages, run Docker, or touch files outside the repo; allow reads, tests, lint and typecheck.
- Keep one phase per session; commit often.
