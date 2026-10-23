# 00. Constitution

These principles override convenience, speed, and cleverness. Every phase, task, and PR is checked against them.
Amending this file requires an explicit entry in `specs/progress.md` under "Constitution changes".

## Article I: Spec is the source of truth
1. Build only what the specs describe. Do not add features, settings, or screens that are not specified.
2. If a spec is ambiguous, write the question to `specs/open-questions.md`, pick the **safest, simplest** interpretation, note it, and continue. Do not block unless the question is marked `BLOCKING`.
3. If you discover the spec is wrong, fix the spec first (small, explicit edit), then the code. Record it in `specs/progress.md`.
4. New ideas go to `specs/backlog.md`. Never into the current phase.

## Article II: Simplicity and minimalism (product)
1. Minimal UI, maximum clarity. Each screen has one primary action. Prefer progressive disclosure over dense toolbars.
2. Defaults should be right for 90% of users. Settings are a last resort.
3. If a feature needs a tooltip to be understood, redesign the feature first.
4. Visual language: Google-style. White space, 1px borders, one accent color, subtle motion. See `03-design-system.md`.

## Article III: Safety by default (product)
1. Destructive actions (delete item/table, bulk delete, overwrite on import, drop index) require a confirmation dialog that states exactly what will happen and how many items are affected (when known).
2. Connections can be tagged **Local / Dev / Staging / Production**. Production requires typed confirmation (type the table name) for destructive actions.
3. **Read-only mode** per connection is enforced **on the server**: all mutating endpoints return `403 READ_ONLY` when enabled. The UI also hides or disables mutation controls.
4. Full-table **Scan** against a non-local endpoint shows a one-time inline hint about read capacity cost. Never block, only inform. Always show `Consumed capacity` and `Scanned vs Returned` counts when available.
5. Never auto-run destructive PartiQL (`DELETE`, `UPDATE`, `INSERT`) without the same confirmation flow.

## Article IV: Security
1. Credentials are accepted once at connect time, held **server-side in memory** (encrypted at rest only if the user checks "Remember this connection"), and are never returned to the browser, logged, or put in URLs.
2. The server binds to `127.0.0.1` by default. Non-loopback binding requires an explicit flag plus a startup warning.
3. Enforce Origin checking and a per-session token (httpOnly, SameSite=Strict cookie) so other websites cannot drive the local API (CSRF / DNS-rebinding defense).
4. Never log request bodies that may contain item data at `info` level. Redact `secretAccessKey`, `sessionToken`, `Authorization`.
5. Do not add telemetry or any network call that is not to the user's DynamoDB endpoint.
6. Validate and size-limit all inputs (Zod). Reject unknown keys.

## Article V: Engineering quality
1. TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any`. No non-null assertions without a comment.
2. Types for API payloads come from `packages/shared` Zod schemas (single source of truth).
3. Pure logic (marshalling, expression building, error mapping, filters) lives in small pure functions with unit tests written **first**.
4. No dead code, no commented-out code, no `console.log` (use the logger).
5. Dependencies: justify every new one in the PR description or commit body. Prefer platform and already-approved libs. See the approved list in `02-architecture.md`.
6. Files stay small and focused (soft limit: 250 lines per component/module). Extract hooks and helpers.
7. Naming: components `PascalCase.tsx`, hooks `useThing.ts`, utilities `kebab-case.ts`, tests `*.test.ts(x)` next to the source.

## Article VI: DynamoDB correctness
1. Preserve DynamoDB types exactly (S, N, B, SS, NS, BS, L, M, BOOL, NULL). No silent coercion.
2. Numbers are strings on the wire and in the editor; use lossless parsing. Never `Number()` a stored number for display or editing.
3. Use `ExpressionAttributeNames` and `ExpressionAttributeValues` for **every** expression. Never interpolate user text into expressions.
4. Paginate with `LastEvaluatedKey` / `ExclusiveStartKey` (or `NextToken` for PartiQL). Never assume one call returns everything.
5. Respect limits: 1 MB per read page, 400 KB per item, 25 items per `BatchWriteItem`, 100 per `BatchGetItem`. Retry `UnprocessedItems` with exponential backoff and jitter.
6. Show DynamoDB errors as human messages while keeping the original code in a "Details" disclosure.

## Article VII: Accessibility and inclusivity
1. WCAG 2.1 AA minimum. Full keyboard navigation. Visible focus. Correct roles and labels.
2. Contrast verified in light and dark themes. Never convey state by color alone.
3. Respect `prefers-reduced-motion` and `prefers-color-scheme`.
4. All copy is plain, friendly, and specific. No jargon where a clearer word exists. See `ux-copy` guidance in the UI skill.

## Article VIII: Performance
Budgets live in `05-quality-and-testing.md`. Highlights: virtualized grids (10k+ rows smooth), lazy-loaded Monaco, route-level code splitting, request cancellation on navigation, no layout shift on load.

## Article IX: Process
1. One phase at a time. Stop at the end of each phase.
2. One task per commit. Conventional Commits.
3. A task is done only when: code, tests, types, lint, a11y, light/dark, empty/loading/error states are all handled.
4. A phase is done only when `pnpm verify` is green and **every acceptance criterion** in the phase file is checked with evidence (test name or screenshot path) in `specs/progress.md`.
5. Prefer reversible decisions. Document irreversible ones as ADRs in `02-architecture.md`.
