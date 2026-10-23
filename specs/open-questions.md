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
- [Q-006] `/__design` must be axe-tested, and the phase also says it is not in the production build. Default chosen: register the route only when `import.meta.env.DEV` is true. Playwright hits it through `pnpm dev`. The production bundle omits the gallery module. (Phase 1, 2026-10-23)
- [Q-008] Theme mode is both a Zustand field and the `mui-mode` key the bootstrap script reads. Default chosen: mode is stored only under `mui-mode` (`light`, `dark`, or `system`). Density, sidebar collapsed, and drawer width use a separate `dynamo-studio-ui` key. Auto-collapse below 1100px forces the rail and does not overwrite the saved preference. (Phase 1, 2026-10-23)
- [Q-010] About needs a docs link, and this repo has no docs site or GitHub origin. Default chosen: the dialog shows "DynamoDB Studio" and version `0.0.0`, with no external URL. The commit hash waits for Phase 8. (Phase 1, 2026-10-23)
- [Q-011] `GET /connections` is in the API contract and missing from the Phase 2 route list. Default chosen: implement it. The switch menu and a second tab read this list. (Phase 2, 2026-10-23)
- [Q-012] `PATCH /profiles/:id` has no body schema. Default chosen: `name`, `endpoint`, `region`, `env`, `readOnly`, and optional `auth`. Omitting `auth` keeps the stored secret. Responses still omit secrets. (Phase 2, 2026-10-23)
- [Q-013] `tableCountSample` could mean a full table count. Default chosen: the number of names from `ListTables` with `Limit: 1` (0 or 1). No extra pages. (Phase 2, 2026-10-23)
- [Q-014] Invalid credentials and access denied share `ACCESS_DENIED`, while the connect copy uses two sentences. Default chosen: one code. `error-copy.ts` picks the sentence from `details.awsCode`. TLS and unreachable share `ENDPOINT_UNREACHABLE` and split the same way. (Phase 2, 2026-10-23)
- [Q-015] A real session guard would bounce the Phase 1 shell route `/c/local/...`, and the master plan says the table list stays empty. Default chosen: `/c/:id` redirects home when that connection is not in the session. The live sidebar renders no mock tables. Shell component tests keep their fixtures. Shell Playwright reaches the workspace only after a real connect, and it stops requiring a "users" row. (Phase 2, 2026-10-23)
- [Q-016] The read-only probe must not exist in production. Default chosen: `POST /connections/:id/mutations/probe` is registered only when `NODE_ENV=test` or `buildApp({ enableProbe: true })`. `enableProbe: false` forces it off. A test expects 404 in that mode. (Phase 2, 2026-10-23)
- [Q-017] Connect logs must not leak credentials. Default chosen: a test captures logs during a connect that sends `secretAccessKey`, `sessionToken`, and `Authorization`, and asserts those values never appear. (Phase 2, 2026-10-23)
- [Q-018] Sessions and SDK clients need bounds. Default chosen: `client.destroy()` on delete, disconnect, and session expiry. Idle sessions expire after 8 hours. A session holds at most 10 connections. (Phase 2, 2026-10-23)
- [Q-019] AC-2.8 must run in CI without stopping DynamoDB Local. Default chosen: the test connects through a closable TCP proxy, then closes the proxy and expects the connection-lost banner within 35s. (Phase 2, 2026-10-23)

## Resolved

- [Q-007] `/` was a connect placeholder until Phase 2. Resolved: `/` is the connect card from design section 4.1. A missing session connection redirects to `/?notice=session-expired`. (Phase 2, 2026-10-23)
- [Q-009] AC-1.7 capped initial JS at 150 KB gzip. Resolved: the production bundle is 201611 bytes gzip with MUI 9, path imports, and one outlined icon style. AC-1.7 records that size. The Phase 8 budget stays 250 KB. (Phase 1, 2026-10-23)
