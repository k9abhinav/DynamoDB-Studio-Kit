# DynamoDB Studio: Spec-Driven Build Kit

A complete kit for building **DynamoDB Studio**, a beautiful, minimal, Google-style DynamoDB client
(React + Material UI + Tailwind), using **Spec-Driven Development (SDD)** with Claude Code or Codex.

You paste in a URL, click **Connect**, and get a smooth, friendly workspace to browse tables, query,
edit items, run PartiQL, and import/export data.

---

## 1. What is in this kit

```
dynamo-studio-kit/
├── README.md                      <- you are here
├── AGENTS.md                      <- canonical agent instructions (Codex reads this natively)
├── CLAUDE.md                      <- Claude Code memory (imports AGENTS.md + Claude-specific notes)
├── specs/
│   ├── 00-constitution.md         <- non-negotiable principles & guardrails
│   ├── 01-product-spec.md         <- WHAT & WHY: vision, personas, journeys, feature catalog
│   ├── 02-architecture.md         <- HOW: stack, monorepo layout, data flow, security model
│   ├── 03-design-system.md        <- Google-style UI tokens, layout, components, ASCII mockups
│   ├── 04-api-contract.md         <- backend REST contract + error model
│   ├── 05-quality-and-testing.md  <- test strategy, budgets, CI, definition of done
│   ├── progress.md                <- live phase tracker (the agent updates this)
│   ├── backlog.md                 <- ideas that are OUT of scope (parking lot)
│   ├── open-questions.md          <- ambiguities the agent must park instead of guessing
│   └── phases/
│       ├── phase-0-foundation.md
│       ├── phase-1-design-system-app-shell.md
│       ├── phase-2-backend-and-connection.md
│       ├── phase-3-table-explorer.md
│       ├── phase-4-items-browser.md
│       ├── phase-5-item-editor-crud.md
│       ├── phase-6-query-builder-partiql.md
│       ├── phase-7-table-management-import-export.md
│       └── phase-8-polish-hardening-packaging.md
├── .claude/
│   ├── skills/
│   │   ├── spec-driven-workflow/SKILL.md
│   │   ├── dynamodb-expert/SKILL.md
│   │   ├── google-minimal-ui/SKILL.md
│   │   └── quality-gates/SKILL.md
│   └── commands/
│       ├── phase.md               <- /phase 3  -> runs the full SDD loop for phase 3
│       └── verify.md              <- /verify   -> runs quality gates + acceptance audit
└── prompts/
    ├── 00-master-plan-mode-prompt.md   <- THE prompt to paste first (plan mode)
    ├── 01-phase-execution-prompt.md    <- per-phase prompt template
    ├── 02-codex-prompt.md              <- same flow tuned for Codex
    └── 03-review-and-fix-prompts.md    <- audit, bugfix, polish, security prompts
```

## 2. Quick start (Claude Code)

1. Create an empty project folder and copy the **contents** of this kit into it.
2. `git init` and make a first commit (`chore: add spec kit`).
3. Start Claude Code in that folder: `claude`.
4. Enter **plan mode** (press `Shift+Tab` until "plan mode" shows, or use `/plan`).
5. Paste the whole of `prompts/00-master-plan-mode-prompt.md`.
6. Claude reads the specs, may ask a few clarifying questions, then returns a plan. Review it, push back, approve.
7. Execute phase by phase. For each phase:
   - `/clear` (fresh context keeps quality high)
   - `/phase 0` (or paste `prompts/01-phase-execution-prompt.md` with the phase filled in)
   - Claude re-enters plan mode for that phase, you approve, it implements, tests and ticks `specs/progress.md`
   - `/verify` then commit then next phase

## 3. Quick start (Codex)

1. Copy the kit into the project folder. Codex reads `AGENTS.md` automatically.
2. Paste `prompts/02-codex-prompt.md` for the planning run, then use the phase prompt from
   `prompts/01-phase-execution-prompt.md` for every phase.
3. The skills are plain Markdown. `AGENTS.md` tells Codex to read the relevant `SKILL.md` before each kind of task.

## 4. The Spec-Driven loop (used in every phase)

```
CONSTITUTION -> SPECIFY -> CLARIFY -> PLAN -> TASKS -> IMPLEMENT -> VERIFY -> RECORD
 (rules)        (phase     (park      (design  (small   (TDD, small  (gates +   (progress.md,
                 spec)      questions) the HOW) steps)   commits)     acceptance) commit)
```

The agent is never allowed to invent requirements. Anything not in the specs goes to `specs/open-questions.md`
(blocking) or `specs/backlog.md` (non-blocking).

## 5. Tips that make a big difference

- **One phase per session.** Run `/clear` between phases. State lives in `specs/progress.md` and git, not chat history.
- **Plan mode first, always.** Reading the plan is the cheapest place to fix a wrong turn.
- **Keep DynamoDB Local running** (`docker compose up -d dynamodb-local`). It makes every phase testable offline.
- **Commit per task**, not per phase. Small commits mean cheap rollbacks.
- **Design review with screenshots.** From Phase 1 on, ask the agent to run Playwright and screenshot light and dark mode, then compare against `03-design-system.md`.
- **If the output drifts** (too many shadows, too many colors, stray inline styles) run prompt `P-DESIGN` from `prompts/03-review-and-fix-prompts.md`.

## 6. Stack at a glance

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, TypeScript (strict), MUI (latest stable), Tailwind CSS v4, TanStack Query/Table/Virtual, Zustand, React Router, Monaco |
| Backend | Node 22, Fastify, AWS SDK v3 (`client-dynamodb`, `lib-dynamodb`, `util-dynamodb`), Zod, Pino |
| Shared | `packages/shared`: Zod schemas and TS types used by both sides |
| Tests | Vitest, Testing Library, Playwright, axe, DynamoDB Local (Docker) |
| Tooling | pnpm workspaces, ESLint (flat), Prettier, Husky + lint-staged, GitHub Actions |

> Why a backend at all? Browsers can't safely hold AWS credentials, and real DynamoDB endpoints
> aren't designed for arbitrary browser origins. A tiny local backend keeps secrets out of the browser,
> avoids CORS pain, and enables streaming export/import. See `specs/02-architecture.md` ADR-001.
