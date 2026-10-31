# Security

DynamoDB Studio is a local client. It does not send telemetry. The only network calls are to the endpoint you choose and, when you pick a profile, to the AWS credential chain on this machine.

## Threat model

One person runs the server on their own computer. The session cookie and the profile key live on that machine.

The endpoint URL is user-chosen. That is the SSRF boundary: the server will call whatever `http:` or `https:` URL you enter, including a private address. `file:` and every other scheme are rejected (`packages/shared/src/endpoint.test.ts`). Binding the server somewhere other than loopback logs a warning (`hostBindingWarning` in `apps/server/src/config.ts`). The default bind is `127.0.0.1`.

A copied `profiles.json` is not enough to read secrets. The file and the key are mode `0600`, and the home directory is `0700` (`profile-store.test.ts`). Someone who can read both files can decrypt them. The key never leaves disk and never goes to the browser.

## What the server checks

- The session cookie `ds_session` is httpOnly and SameSite=Strict. Mutations need `x-ds-csrf`. A foreign Origin or a rebinding Host is `FORBIDDEN_ORIGIN`. `apps/server/src/plugins/security.test.ts`.
- `ALLOWED_ORIGINS` is an optional comma-separated list of extra origins. The built-in set is the dev server on port 5173 and the app on port 8080, for both `127.0.0.1` and `localhost`. There is no separate trust-proxy setting. If you put the app behind a proxy, set `ALLOWED_ORIGINS` to the browser's origin and keep the bind on loopback unless you mean to expose it.
- Read-only is `assertWritable` on item writes, table management, PartiQL mutations, import, and clear. A read-only PartiQL `UPDATE` is `403 READ_ONLY` (`partiql.int.test.ts`). Import and clear use the same guard (`import.ts`, `clear.ts`).
- Request bodies are Zod strict objects. The JSON limit is 2 MB. `POST /connections`, `POST /connections/test`, and `POST /profiles/:id/connect` are limited to 30 per minute. The 31st connect in a test returns 429 (`connections.test.ts`).
- Query names and values are `#n` and `:v` placeholders. PartiQL parameters are bound values. The server classifies the statement. It does not trust a client-sent kind.
- Logs redact `secretAccessKey`, `sessionToken`, and `Authorization` (`logger.test.ts`). The request log keeps the method and URL and drops headers. Responses do not echo secret values from a validation error (`security.test.ts`).

## Dependency audit

`pnpm audit` on 2026-10-31 reported 7 issues: 3 low, 2 moderate, 1 high, 1 critical.

The high and critical issues are both in `dompurify` versions `>=3.4.4 <=3.4.16`, pulled in by `monaco-editor`:

- Critical: [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7)
- High: [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr)

The patched release is `dompurify@3.4.17`. This repository does not import DOMPurify. The exception is the transitive copy inside Monaco. The lockfile is committed. Low and moderate issues are not treated as release blockers.
