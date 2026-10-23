# Open Questions

Rule: if the spec is ambiguous, log it here, choose the **safest simplest** default, continue.
Mark `BLOCKING` only if you truly cannot proceed safely. Resolve by editing the spec, then move the entry to "Resolved".

Format: `- [Q-001] [BLOCKING?] question. Default chosen: ... (phase, date)`

## Open

- [Q-001] DynamoDB Local storage is specified as in-memory or a volume. Default chosen: `-sharedDb -inMemory` on port 8000. Seed again after a container restart. (Phase 0, 2026-10-23)
- [Q-002] AGENTS.md comments that `pnpm dev:db` includes seed, while FR-0.2 lists `pnpm seed` separately. Default chosen: `dev:db` only runs `docker compose up -d dynamodb-local`. (Phase 0, 2026-10-23)
- [Q-003] `exactOptionalPropertyTypes` is "where practical". Default chosen: on in `tsconfig.base.json`. Turn it off in one package only if Zod inference cannot be fixed, and log that. (Phase 0, 2026-10-23)
- [Q-004] The approved dependency list is larger than Phase 0. Default chosen: install only what this phase imports. MUI, Tailwind, Monaco, Zustand, and React Router wait until Phase 1. `pnpm dev` is a small Node process spawner, so `concurrently` is not added. (Phase 0, 2026-10-23)
- [Q-005] Hooks should typecheck staged files, but project references cannot typecheck one file alone. Default chosen: lint-staged runs ESLint and Prettier on staged files; the pre-commit hook then runs workspace `pnpm typecheck`. (Phase 0, 2026-10-23)

## Resolved
(none yet)
