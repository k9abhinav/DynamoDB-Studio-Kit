# Phase 8: Polish, Hardening and Packaging

**Goal:** Make it feel finished: delightful details, rock-solid accessibility and performance, security re-review, and one-command distribution.
**Specs:** 01 (APP-1..APP-6), 03 (all), 05 (all), 00 (all).
**Skills:** google-minimal-ui, quality-gates, spec-driven-workflow, dynamodb-expert (final audit of correctness).

## 1. In scope
- **UX polish pass** over every screen against `03-design-system.md` (spacing, hierarchy, copy, motion, dark mode parity).
- **Command palette** completion: jump to table, switch connection, run actions (create item, new table, export, toggle theme/density, open shortcuts), recent items; fuzzy search.
- **Shortcut help** completeness and consistency; all shortcuts documented and tested.
- **Offline/disconnected** handling across the app (banner, retry, queued UI state), error boundaries per route with friendly recovery.
- **Performance pass:** bundle analysis, code splitting, memoization, grid profiling, server profiling; meet budgets in `05`.
- **Accessibility pass:** full axe sweep, manual keyboard audit, screen reader smoke test notes (VoiceOver/NVDA checklist), zoom 200%, reduced motion, high-contrast sanity.
- **Security re-review:** run the checklist in `05` section 8; dependency audit; threat model doc (`docs/SECURITY.md`).
- **Packaging:**
  - Production build served by the Fastify server (single port).
  - `Dockerfile` (multi-stage, non-root, small image) and `docker-compose.example.yml` (app + DynamoDB Local).
  - npm-publishable CLI: `npx dynamo-studio --port 8080 --open` (bin script, prints URL, opens browser, flags for host/port/home).
  - Versioning with `CHANGELOG.md` and a semver script. License is MIT.
- **Docs:** `README.md` (hero GIF/screenshots, 60-second quick start, features, security model, FAQ), `docs/USER-GUIDE.md`, `docs/ARCHITECTURE.md` (link to specs), `docs/CONTRIBUTING.md`, `docs/SECURITY.md`, LICENSE.
- **Seed sample data experience:** "Connect to sample DynamoDB Local" helper in docs only (not in-app).

## 2. Out of scope
New features. Anything not already in specs goes to `specs/backlog.md`.

## 3. Functional requirements
- **FR-8.1** Every screen has designed loading, empty, error and success states (checklist table in `docs/UI-STATES.md` with screenshot links).
- **FR-8.2** Command palette actions listed above work via keyboard only; results ranked sensibly (recent first); `>` prefix for actions-only mode.
- **FR-8.3** Theme parity: no component looks broken or low-contrast in dark mode (visual regression screenshots stored and compared with a small tolerance).
- **FR-8.4** Budgets from `05` section 3 are met and recorded in `specs/progress.md` metrics log.
- **FR-8.5** `npx dynamo-studio` (from a local tarball built by `pnpm pack`) starts the app and serves the UI; `Dockerfile` image runs as non-root, exposes 8080, healthcheck on `/api/v1/health`.
- **FR-8.6** Graceful shutdown (SIGINT/SIGTERM): in-flight streams are aborted cleanly, sessions cleared, no orphan processes.
- **FR-8.7** Logging is useful and safe: request id correlation, redaction verified by test; `LOG_LEVEL` honored.
- **FR-8.8** `About` dialog shows version, commit hash (build-time), license, link to docs.
- **FR-8.9** First-run experience: friendly hint on Connect screen about DynamoDB Local (`docker run -p 8000:8000 amazon/dynamodb-local`) shown only when no saved connections exist; dismissible.
- **FR-8.10** `pnpm verify` and CI are green; release workflow builds artifacts (Docker image + npm tarball) on tag.

## 4. Tasks
- [x] T8.1 UX audit: screenshot every screen/state light+dark; list discrepancies vs design system; fix all
- [x] T8.2 Command palette completion + tests
- [x] T8.3 Shortcut audit + help dialog completeness + tests
- [x] T8.4 Error boundaries, offline banner, recovery flows + tests
- [x] T8.5 Performance pass (bundle visualizer, lazy boundaries, grid profiling, server profiling) + record metrics
- [x] T8.6 Accessibility pass (axe sweep, manual keyboard audit, screen-reader notes, zoom/reduced motion)
- [x] T8.7 Security re-review + `docs/SECURITY.md` + dependency audit
- [x] T8.8 Production build + static serving + graceful shutdown + tests
- [x] T8.9 Dockerfile + compose example + image smoke test in CI
- [x] T8.10 CLI bin (`npx dynamo-studio`), flags, tarball test
- [x] T8.11 Docs: README, USER-GUIDE, ARCHITECTURE, CONTRIBUTING, SECURITY, CHANGELOG
- [ ] T8.12 Visual regression baseline + final E2E suite of journeys J1-J5 in both themes
- [ ] T8.13 Release workflow; tag v1.0.0-rc.1
- [ ] T8.14 Final spec reconciliation + progress summary + backlog review

## 5. Acceptance criteria
- **AC-8.1** All journeys J1-J5 pass E2E in light and dark.
- **AC-8.2** axe: 0 serious/critical across all routes and key states; manual keyboard audit checklist complete and committed.
- **AC-8.3** Performance budgets met; numbers recorded (initial JS, FCP, grid fps, API overhead).
- **AC-8.4** Security checklist fully ticked; `pnpm audit` has no high/critical unresolved issues (or documented exceptions).
- **AC-8.5** `docker build` + run works; container is non-root; `/api/v1/health` healthy; image size reported.
- **AC-8.6** `npx` flow from a packed tarball works on a clean machine/container (CI job).
- **AC-8.7** Docs enable a new user to reach J1 in under 5 minutes (follow README literally in a clean environment).
- **AC-8.8** No TODOs, dead code, or console output remain; `specs/open-questions.md` has no BLOCKING items.
- **AC-8.9** Visual regression suite passes; intentional changes documented.
- **AC-8.10** Graceful shutdown test: SIGTERM during an export ends the stream and process exits < 5s with code 0.

## 6. Edge cases
Port in use (friendly CLI error with suggestion); running behind a reverse proxy (document `ALLOWED_ORIGINS`/`TRUST_PROXY`); Windows paths for `DYNAMO_STUDIO_HOME`; Safari quirks (File System Access fallback); Firefox Monaco worker config; corporate proxy env vars honored by the AWS SDK.

## 7. Definition of done
Standard phase DoD plus release candidate tagged.
