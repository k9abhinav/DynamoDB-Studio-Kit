# Phase 2: Backend Core and Connection (the hero journey)

**Goal:** Paste a URL, click **Connect**, land in the workspace with a real connection. Secure sessions, saved connections, and read-only enforcement foundations.
**Specs:** 01 (CON-1..CON-7), 02 (ADR-001, 008, 5.1), 04 (Session, Connections, Profiles, errors), 00 Article III/IV, 03 section 4.1.
**Skills:** dynamodb-expert, google-minimal-ui, quality-gates, spec-driven-workflow.

## 1. In scope
**Server**
- Plugins: security (Origin/Host check, CSRF header, cookie session), error handler + `ErrorMapper`, rate limit on `/connections*`, static serving of web build in production.
- `ConnectionManager`: create/test/get/delete/patch connections; builds `DynamoDBClient` per auth type; credential providers (`local` -> static dummy; `keys`; `profile` via `fromIni`/`fromNodeProviderChain` with profile; `default-chain`); stores connection meta + client in a Map bound to session.
- Endpoint validation: only `http:`/`https:`, normalized (add scheme, strip trailing slash), loopback detection helper.
- Routes: `GET /session`, `POST /connections/test`, `POST /connections`, `GET/DELETE/PATCH /connections/:id`, `GET/PATCH/DELETE /profiles`, `POST /profiles/:id/connect`.
- Encrypted `ProfileStore` (AES-256-GCM, `0600` files, atomic writes) with migration-safe versioned schema.
- Read-only guard as a reusable Fastify `preHandler` factory used by all future mutating routes.

**Web**
- Connect screen per `03` section 4.1: smart URL parsing (CON-5), region auto-fill, auth method switcher (progressive fields), "More options" (name, env, read-only, remember), **Test** and **Connect**, Enter to submit, inline errors, recent/saved connections with quick connect, edit, delete.
- API client (`lib/api.ts`): fetch wrapper with CSRF, error normalization to typed `ApiError`, `AbortSignal` support.
- Connection store/hooks; workspace route guard (redirect to `/` if connection missing, with friendly message).
- App bar status chip shows name, env color, region, latency (ping `GET /connections/:id` heartbeat every 30s, paused when tab hidden). Disconnect and switch-connection menu.

## 2. Out of scope
Listing tables (Phase 3). Everything after.

## 3. Functional requirements
- **FR-2.1** URL parsing rules: `localhost:8000` -> `http://localhost:8000`; `*.amazonaws.com` -> https + region inferred; `dynamodb.<region>.amazonaws.com` sets region; blank endpoint means real AWS using region only, auth type `local` is rejected, and the default auth is **Default credential chain**; invalid URL shows inline error as user pauses typing (debounced 400ms), not on every keystroke.
- **FR-2.2** If the endpoint host is loopback (`localhost`, `127.0.0.1`, `::1`, `host.docker.internal`), default auth to **Local** and env tag **Local**; otherwise default to **Default credential chain** and env **Dev**.
- **FR-2.3** **Test** shows latency and a green inline success ("Connected in 12 ms"); **Connect** performs test + creates the session and navigates to `/c/:connectionId`.
- **FR-2.4** Failure mapping examples (exact copy lives in `lib/error-copy.ts`): unreachable -> "Couldn't reach {endpoint}. Is DynamoDB running and the URL correct?"; invalid creds -> "AWS rejected these credentials."; access denied -> "These credentials can't list tables (missing dynamodb:ListTables)."; TLS issue -> "Couldn't establish a secure connection."
- **FR-2.5** `remember` stores the profile; if auth contains secrets they are encrypted. Without `remember`, nothing is written to disk.
- **FR-2.6** Saved connection list shows env dot, name, host/region, last used (relative time), kebab menu: Connect, Edit, Delete. Delete requires confirm.
- **FR-2.7** Read-only toggle sets server flag; `PATCH /connections/:id` can flip it later; a test-only mutating route proves the guard returns `403 READ_ONLY`.
- **FR-2.8** Server never returns secrets in any response (contract test scans responses).
- **FR-2.9** Heartbeat uses `GET /connections/:id` every 30s and is not covered by the connect rate limit. Failure shows an inline "Connection lost. Retry / Disconnect" banner (not a dialog).
- **FR-2.10** Session security: requests without CSRF header or with bad Origin are rejected with proper codes (tests).

## 4. Tasks
- [ ] T2.1 Shared Zod schemas for session, auth, connection, profile, error (`packages/shared`) + tests
- [ ] T2.2 Server security plugin (origin/host/CSRF/session) + tests
- [ ] T2.3 ErrorMapper (AWS + network -> codes) with table-driven tests
- [ ] T2.4 Endpoint normalizer + loopback detection + tests
- [ ] T2.5 ConnectionManager + credential providers + routes + integration tests (DynamoDB Local)
- [ ] T2.6 ProfileStore (encryption, atomic write, perms) + routes + tests
- [ ] T2.7 Read-only guard + test route + tests
- [ ] T2.8 Web API client + ApiError + error-copy + tests
- [ ] T2.9 URL parsing util (shared between server/web where sensible) + tests
- [ ] T2.10 ConnectCard UI (form with react-hook-form + zod), states, animations, tests
- [ ] T2.11 Saved connections list + actions + tests
- [ ] T2.12 Workspace guard, status chip, heartbeat, disconnect/switch + tests
- [ ] T2.13 Playwright: J1 against DynamoDB Local (light+dark screenshots), failure path, keyboard-only
- [ ] T2.14 Security review checklist (`05` section 8) executed and recorded
- [ ] T2.15 Progress + phase summary

## 5. Acceptance criteria
- **AC-2.1** Starting from `/`, typing `localhost:8000` and pressing Enter reaches the workspace in under 3 interactions (E2E).
- **AC-2.2** Wrong URL shows the friendly unreachable message with the entered endpoint; fixing and retrying works without page reload.
- **AC-2.3** Keys/profile/default-chain auth validated by integration tests (profile and chain can use env var credentials in CI).
- **AC-2.4** Mutating guard: read-only connection returns `403 READ_ONLY` (integration test); toggling via PATCH takes effect immediately.
- **AC-2.5** `GET/POST` responses never contain `secretAccessKey`/`sessionToken` (automated deep scan test).
- **AC-2.6** Profile file permissions are `0600` and ciphertext differs for the same secret across writes (unique IV) (test).
- **AC-2.7** CSRF/Origin/Host rejections tested; DNS rebinding Host check tested.
- **AC-2.8** Heartbeat updates latency chip; killing DynamoDB Local shows the "Connection lost" banner within 35s (E2E with docker stop).
- **AC-2.9** axe: 0 serious/critical on the connect screen in both themes; full keyboard path works.
- **AC-2.10** Security checklist all ticked or explicitly waived with reason.

## 6. Edge cases
IPv6 endpoints; endpoints with paths (`http://host:8000/ddb`); trailing slash; credentials typed with whitespace (trim); pasting a full AWS CLI command (do not parse, show hint); two tabs share one session cookie and see the same connections; server restart (sessions lost -> redirect to `/` with "Session expired. Reconnect." and saved profile quick connect).

## 7. Definition of done
Standard phase DoD plus security checklist recorded.
