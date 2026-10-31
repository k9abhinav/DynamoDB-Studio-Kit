# DynamoDB Studio

A calm, minimal client for DynamoDB. Paste an endpoint, click **Connect**, and browse tables, edit items, run PartiQL, and move data in and out.

![Connect screen](docs/screenshots/phase-2/connect-light.png)

![Items](docs/screenshots/phase-4/items-light.png)

![PartiQL](docs/screenshots/phase-6/partiql-light.png)

## Quick start

You need Node.js 22 or newer and Docker.

1. Start DynamoDB Local:

```bash
docker run --rm -p 8000:8000 amazon/dynamodb-local
```

2. Install, seed a few sample tables, and start the app:

```bash
pnpm install
pnpm seed
pnpm dev
```

3. Open [http://127.0.0.1:5173](http://127.0.0.1:5173).
4. Paste `http://localhost:8000` into **Endpoint**. Choose **Local** and click **Connect**.
5. The workspace lists the sample tables (`users`, `orders`, `sessions`, `edge-cases`). Pick one to see its items.

`pnpm dev` serves the UI on port 5173 and the API on port 8080. If 8080 is already taken, stop the other process or start the server with a free port.

## Features

- Connect to DynamoDB Local, a custom endpoint, or AWS (access key, profile, or the default credential chain).
- Search tables, inspect keys, indexes, and TTL, and create a table with a guided form.
- Scan and query a virtualized grid, then open an item and copy it as JSON.
- Edit JSON with live validation, save, and undo.
- Run PartiQL with syntax highlighting, history, and saved queries.
- Import JSON, NDJSON, or CSV after a preview. Export JSON, NDJSON, or CSV.
- Light and dark themes, a command palette, and keyboard shortcuts (`?` opens the list).

## Security

Credentials stay on the server after connect. The browser keeps an httpOnly session cookie and sends `x-ds-csrf` on writes. A foreign `Host` or `Origin` is rejected. Read-only mode is enforced on the server. Destructive actions ask for confirmation, and a production-tagged connection asks you to type the name.

The API binds to loopback unless you set `HOST`. A non-loopback bind logs a warning. `ALLOWED_ORIGINS` is a comma-separated list of extra browser origins when you put the app behind a reverse proxy.

Details and the dependency-audit exception are in [docs/SECURITY.md](docs/SECURITY.md).

## Install from a tarball or image

Build a local tarball (the root package stays private; this does not publish):

```bash
pnpm build
pnpm exec tsx scripts/pack-cli.ts
npm install -g ./dist-pack/dynamo-studio.tgz
dynamo-studio --port 8080 --host 127.0.0.1
```

`dynamo-studio` accepts `--port`, `--host`, `--home`, and `--open`. If the port is in use, the message names that port and suggests `--port`.

The container image is non-root, listens on 8080, and checks `/api/v1/health`. See [docker-compose.example.yml](docker-compose.example.yml). Do not publish that example while something else is already bound to host port 8080.

## FAQ

**The connect card says it could not reach my endpoint.** The message includes the URL you typed. For DynamoDB Local, check that `docker run -p 8000:8000 amazon/dynamodb-local` is still running and that the endpoint is `http://localhost:8000`.

**Can I avoid writing data?** Turn on **Read-only** before you connect. The server rejects writes for that session.

**Where are saved connections?** In the home directory under `.dynamo-studio`, or in the directory you pass with `--home` / `DYNAMO_STUDIO_HOME`. Secrets are not stored in the browser.

**Does an edit detect every concurrent change?** The save checks the item you loaded, then writes with attribute equality when the item is small enough. An attribute added by someone else between the read and the write is not detected. The guide explains that limit.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md), [docs/USER-GUIDE.md](docs/USER-GUIDE.md), and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). License: MIT.
