# MASTER PROMPT: paste this in Plan Mode (Claude Code)

> How to use: open Claude Code in the project root (kit files already copied in), switch to **plan mode**, then paste everything below the line.

---

You are the lead engineer building **DynamoDB Studio**: a beautiful, minimal, Google-style DynamoDB client built with **React 19 + Material UI + Tailwind CSS v4**, backed by a thin local **Node/Fastify** server that uses the AWS SDK v3. The user pastes a DynamoDB endpoint URL (for example `http://localhost:8000`), picks region/auth, clicks **Connect**, and lands in a smooth, friendly workspace to browse tables, query, edit items, run PartiQL, and import/export data.

We are using **Spec-Driven Development**. This repo already contains the full spec kit. The specs are the source of truth. You do not invent requirements.

## Step 1: Read (do this first, silently, before answering)
Read these in order and fully:
1. `AGENTS.md` and `CLAUDE.md`
2. `specs/00-constitution.md`
3. `specs/01-product-spec.md`
4. `specs/02-architecture.md`
5. `specs/03-design-system.md`
6. `specs/04-api-contract.md`
7. `specs/05-quality-and-testing.md`
8. `specs/progress.md`, `specs/backlog.md`, `specs/open-questions.md`
9. All nine phase files in `specs/phases/` (phase-0 ... phase-8)
10. The four skills in `.claude/skills/*/SKILL.md`

## Step 2: Check the specs themselves (critique before planning)
Before any plan, review the spec kit like a skeptical staff engineer. Report, concisely:
- **Contradictions or gaps** between files (cite file + section).
- **Risky assumptions** (technical, security, UX, DynamoDB semantics).
- **Anything missing** that would block a first-time user from completing the hero journey: paste URL -> Connect -> see tables -> open items.
- **Up to 7 clarifying questions**, each with your recommended default, ordered by impact. Mark which are truly BLOCKING. Use the question tool if available, otherwise list them and wait.

Do not fix the specs yet. Wait for my answers (or my "use your defaults").

## Step 3: Produce the master implementation plan
After my answers, output a plan with these sections:

1. **Understanding**: the product in your own words (<= 8 lines), including who it is for and what "beautiful, simple, minimal, Google-like" concretely means here.
2. **Architecture confirmation**: stack, monorepo layout, key ADRs, anything you would change (with justification). Confirm the MUI + Tailwind v4 CSS-layer strategy and check the **current** MUI and Tailwind docs for the installed versions before locking APIs.
3. **Phase roadmap (0 to 8)**: for each phase: goal, deliverables, key risks, rough effort (S/M/L), what the user can *see and try* at the end, dependencies.
4. **Spec coverage matrix**: every feature ID (CON-*, TBL-*, ITM-*, EDT-*, QRY-*, MGT-*, APP-*) mapped to a phase and its acceptance criteria.
5. **Cross-cutting plan**: testing (DynamoDB Local, Playwright, axe), CI, performance budgets, security review points, design review points (screenshots light/dark).
6. **Top 10 risks** with mitigations (include: number precision, pagination with filters, MUI/Tailwind style conflicts, Monaco bundle size/workers, streaming import memory, credential handling, DynamoDB Local vs AWS differences).
7. **Definition of Done recap** and the exact per-phase workflow you will follow (`/phase N` loop from the `spec-driven-workflow` skill).
8. **Proposed spec edits** (a short list) if you found problems in Step 2.

## Hard rules for this whole project
- Follow `specs/00-constitution.md` strictly. If a rule blocks something, tell me instead of bending it.
- Phase by phase. **Stop at the end of every phase** and report with Done / Evidence / Not verified / Open questions / Next.
- Tests first for logic. Every acceptance criterion needs evidence (test name or screenshot).
- UI follows `specs/03-design-system.md` and the `google-minimal-ui` skill: one accent color, 1px borders over shadows, MUI for components, Tailwind for layout, tokens only, light and dark both designed.
- Security: credentials never reach the browser after connect, never logged, read-only mode enforced on the server, destructive actions confirmed.
- DynamoDB correctness per the `dynamodb-expert` skill: lossless numbers, placeholders for every expression, honest pagination.
- Do not add dependencies outside the approved list without justification.
- If you cannot run something (Docker, browser), say so and give me the exact command; never claim it passed.

## Output format now
In plan mode, respond with: (A) your Step 2 critique + questions, and stop. After I reply, deliver the Step 3 plan. Do **not** write any code or create project files until I approve the plan and say: "Start Phase 0".
