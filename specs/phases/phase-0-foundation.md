# Phase 0: Foundation

**Goal:** A clean, fully-tooled monorepo where `pnpm dev`, `pnpm verify`, and DynamoDB Local all work, with zero product features yet.
**Specs referenced:** 00-constitution, 02-architecture (sections 2, 3, 4), 05-quality-and-testing.
**Skills to load:** spec-driven-workflow, quality-gates.

## 1. In scope
- pnpm workspace with `apps/web`, `apps/server`, `packages/shared`.
- TypeScript project references / shared `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` where practical).
- ESLint flat config (typescript-eslint strict, react-hooks, jsx-a11y, import ordering), Prettier, EditorConfig.
- Husky + lint-staged (lint + typecheck on staged files; commit-msg check for Conventional Commits).
- Vite + React 19 app rendering a placeholder page; Fastify server with `/api/v1/health`; Vite dev proxy `/api` -> server.
- Vitest configured in all three packages; Playwright configured with one smoke test; MSW set up in web.
- `docker-compose.yml` with `amazon/dynamodb-local` (in-memory or volume, port 8000, `-sharedDb`).
- `scripts/seed-data.ts` (tables and counts per `05-quality-and-testing.md` section 2), runnable via `pnpm seed`.
- Root scripts exactly as listed in `AGENTS.md`.
- GitHub Actions `ci.yml` (jobs per `05` section 5).
- `.gitignore`, `.nvmrc` (22), `.npmrc` (`engine-strict`), `LICENSE` (MIT), project `README` section "Development".

## 2. Out of scope
Any UI beyond a placeholder; any DynamoDB API route except health.

## 3. Functional requirements
- **FR-0.1** `pnpm install && pnpm dev` starts web (5173) and server (8080); visiting `http://localhost:5173` shows "DynamoDB Studio" placeholder fetched from `/api/v1/health` (proves the proxy).
- **FR-0.2** `pnpm dev:db` starts DynamoDB Local and `pnpm seed` creates and fills seed tables idempotently.
- **FR-0.3** `packages/shared` exports a sample Zod schema (`HealthResponse`) consumed by both web and server (proves the shared pipeline and path aliases).
- **FR-0.4** `pnpm verify` runs lint, typecheck, unit tests, integration tests (health + a DynamoDB Local connectivity test), and build, all green from a clean clone. DynamoDB Local must be running.
- **FR-0.5** Git hooks block a non-conventional commit message and unlinted staged code.

## 4. Tasks
- [x] T0.1 Workspace skeleton, tsconfig base, package manifests, scripts. Before install, confirm every pinned version against the npm registry and record the exact versions in `specs/progress.md`.
- [x] T0.2 Lint, format, hooks
- [x] T0.3 `packages/shared` + `HealthResponse` schema + tests
- [x] T0.4 Server: Fastify app factory (`buildApp`), config loader (Zod-validated env), logger with redaction, `/api/v1/health`, tests
- [x] T0.5 Web: Vite + React 19 + providers stub, proxy, health fetch via TanStack Query, test with MSW
- [x] T0.6 docker-compose + seed script + integration test harness (global setup waits for DynamoDB Local)
- [x] T0.7 Playwright smoke test (page loads, shows "DynamoDB Studio")
- [x] T0.8 CI workflow; badge in README
- [x] T0.9 Update `specs/progress.md` and write the Phase 0 summary

## 5. Acceptance criteria
- **AC-0.1** Fresh clone: `pnpm install && pnpm verify` passes.
- **AC-0.2** `pnpm dev` serves the placeholder with a live health status from the server.
- **AC-0.3** `pnpm dev:db && pnpm seed` yields tables `users`(1000), `orders`(10000), `sessions`, `edge-cases` (verified by an integration test).
- **AC-0.4** `HealthResponse` is imported from `@dynamo-studio/shared` in both apps (grep-able).
- **AC-0.5** Committing `bad message` is rejected; committing `chore: test` passes.
- **AC-0.6** CI workflow file valid and runs the four jobs (verify locally with `act` if available, or lint with `actionlint`).
- **AC-0.7** No `any`, no `console.*` in source (lint enforces).

## 6. Edge cases and notes
- Windows/macOS/Linux path differences: use `cross-env` only if truly needed; scripts should be shell-agnostic (use `tsx`/Node scripts).
- Docker not installed: `pnpm test:int` must fail with a clear message pointing to the README, not a stack trace. `pnpm verify` expects Docker to be up; AC-0.1 assumes that.
- Pin major versions; commit `pnpm-lock.yaml`. Before `pnpm install`, confirm every pinned version against the npm registry. Record the exact versions in `specs/progress.md`. Planning observed `@mui/material` 9.4.0 and `tailwindcss` 4.3 on 2026-10-23; the registry check is authoritative.

## 7. Definition of done
Standard phase DoD (see `05` section 7).
