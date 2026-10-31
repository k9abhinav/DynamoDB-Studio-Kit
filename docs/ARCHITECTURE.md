# Architecture

DynamoDB Studio is a pnpm workspace:

- `apps/web` is the React UI (Vite, MUI, Tailwind).
- `apps/server` is the Fastify API and, in production, the static file server.
- `packages/shared` holds Zod schemas, typed JSON, and the error codes.

The specs in [`/specs`](../specs/02-architecture.md) are the source of truth. Start with [the constitution](../specs/00-constitution.md), [the product spec](../specs/01-product-spec.md), [the architecture spec](../specs/02-architecture.md), [the design system](../specs/03-design-system.md), [the API contract](../specs/04-api-contract.md), and [the quality spec](../specs/05-quality-and-testing.md).

The browser never holds AWS secrets after connect. It calls `/api/v1` with an httpOnly cookie and a CSRF header. The server keeps the DynamoDB client for that session and maps AWS errors to the stable codes in the contract. DynamoDB numbers stay strings end to end.

Production sets `NODE_ENV=production` and serves `apps/web/dist` from the server process. The Docker image and the `dynamo-studio` tarball both use that layout. The process starts with `--max-old-space-size=128`.

## Optimistic concurrency

An update reads the item, hashes it, and then puts the replacement. When the item is small enough, the put also requires the previously loaded top-level attributes to still match. That second check is not a single atomic condition that covers the whole item. An attribute that another writer adds between the read and the write is not detected, and the put can succeed. Large items skip the attribute equalities and return `weakConcurrency: true`. The UI says the check is best-effort and offers reload or overwrite. Do not describe this as full optimistic locking or as a transaction.
