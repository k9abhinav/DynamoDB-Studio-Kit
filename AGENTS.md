# AGENTS.md: DynamoDB Studio

You are building **DynamoDB Studio**: a beautiful, minimal, Google-style DynamoDB client.
The user pastes a DynamoDB endpoint URL (plus region/credentials), clicks **Connect**, and gets a smooth workspace
to explore tables, query, edit items, run PartiQL, and import/export data.

This repository is built with **Spec-Driven Development**. The specs in `/specs` are the source of truth.
If code and spec disagree, the spec wins, or the spec gets updated first with a note in `specs/progress.md`.

## Read order (every session)

1. `specs/00-constitution.md`: non-negotiable rules
2. `specs/master-plan.md`: approved roadmap and locked decisions
3. `specs/progress.md`: where we are (which phase, which tasks are done)
4. The current phase file in `specs/phases/`
5. Only as needed: `01-product-spec.md`, `02-architecture.md`, `03-design-system.md`, `04-api-contract.md`, `05-quality-and-testing.md`

## Skills (plain Markdown, read before the matching kind of work)

| When you are... | Read |
|---|---|
| Starting, planning, or finishing any phase/task | `.claude/skills/spec-driven-workflow/SKILL.md` |
| Touching anything DynamoDB: marshalling, queries, expressions, pagination, errors | `.claude/skills/dynamodb-expert/SKILL.md` |
| Writing or changing any UI | `.claude/skills/google-minimal-ui/SKILL.md` |
| About to say "done", running checks, or reviewing | `.claude/skills/quality-gates/SKILL.md` |

## Stack (fixed, do not swap without an ADR)

- Monorepo: pnpm workspaces. `apps/web`, `apps/server`, `packages/shared`
- Web: React 19 + Vite + TypeScript strict + **MUI (latest stable)** + **Tailwind CSS v4** + TanStack Query / Table / Virtual + Zustand + React Router + Monaco (lazy)
- Server: Node 22 + Fastify + AWS SDK v3 + Zod + Pino
- Tests: Vitest, Testing Library, Playwright, axe-core, DynamoDB Local in Docker

## Commands (created in Phase 0; keep them working at all times)

```
pnpm install
pnpm dev            # web + server concurrently
pnpm dev:db         # docker compose up -d dynamodb-local (+ seed)
pnpm lint
pnpm typecheck
pnpm test           # unit + component
pnpm test:int       # server integration tests against DynamoDB Local
pnpm test:e2e       # Playwright
pnpm build
pnpm verify         # lint + typecheck + test + test:int + build (the gate before "done")
```

## Hard rules (short version; full list in the constitution)

1. Never invent requirements. Ambiguity -> `specs/open-questions.md`, choose the safest default, continue.
2. Strict TypeScript. No `any`, no `@ts-ignore` without a linked comment. Validate every boundary with Zod.
3. UI follows `03-design-system.md`: Google-style, minimal, one accent color, 1px borders over shadows. MUI for components, Tailwind for layout and spacing, no inline style soup.
4. Secrets never reach the browser after connect, never get logged, never get committed.
5. Destructive actions need confirmation. Production-tagged connections need typed confirmation. Read-only mode must be enforced on the **server**, not just hidden in the UI.
6. DynamoDB numbers are strings on the wire. Never convert to JS `number` in a way that loses precision.
7. Tests first for logic (marshalling, expression builders, error mapping). Component tests for interactive UI. Every acceptance criterion maps to at least one test.
8. Small commits, Conventional Commits (`feat(web): ...`, `fix(server): ...`), one task per commit.
9. Finish a phase only when `pnpm verify` is green, every acceptance criterion is checked, and `specs/progress.md` is updated.
10. Stop after each phase. Do not start the next phase without being asked.

## Definition of Done (per task)

Code + tests + types + lint clean + a11y checked (keyboard + labels) + works in light & dark + empty/loading/error states handled + progress updated.
