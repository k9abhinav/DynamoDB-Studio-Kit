# Contributing

DynamoDB Studio is built from the specs in `/specs`. If the code and a spec disagree, fix the spec first or change the code to match it, and note the decision in `specs/progress.md`.

## Setup

```bash
pnpm install
docker run --rm -p 8000:8000 amazon/dynamodb-local
pnpm seed
pnpm dev
```

Node.js 22 is the supported major (`.nvmrc`). Newer Node starts with a warning. Older Node refuses to start.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:int
pnpm test:e2e
pnpm verify
```

Integration tests need DynamoDB Local on port 8000. Playwright reuses a dev server on ports 5173 and 8080 when one is already running. Do not point a second server at 8080.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope: `feat(web)`, `fix(server)`, `docs(specs)`, `test(e2e)`, `chore(repo)`. One task per commit. Do not commit `.env` files, credentials, or `dist/`.

## Design

UI uses MUI components and Tailwind for layout. Tokens live in the design system. One accent color, 1px borders, sentence case, and a keyboard path for every new action. Check light and dark.

## Packaging

`pnpm exec tsx scripts/pack-cli.ts` writes `dist-pack/dynamo-studio.tgz` after `pnpm build`. The root `package.json` stays private. Do not `npm publish` or `docker push` unless a release owner asks. The release workflow only uploads artifacts.
