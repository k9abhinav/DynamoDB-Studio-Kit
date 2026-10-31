import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BatchWriteItemCommand,
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  type WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { afterAll, describe, expect, it } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";
import { deleteLocalTables, uniqueToken } from "../local-cleanup.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const created: string[] = [];

afterAll(async () => {
  await deleteLocalTables(created);
});

describe("export under the memory cap", () => {
  it("exports about 200 items of about 390 KB without exiting", async () => {
    const name = `p8mem${uniqueToken()}`;
    created.push(name);
    const client = localClient();
    try {
      await client.send(
        new CreateTableCommand({
          TableName: name,
          BillingMode: "PAY_PER_REQUEST",
          AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
          KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        }),
      );
      await waitUntilActive(client, name);
      await writeLargeItems(client, name);
    } finally {
      client.destroy();
    }

    const server = await startServer();
    try {
      const port = server.port;
      const open = await session(port);
      const connectionId = await connect(port, open);
      const body = await exportTable(port, open, connectionId, name);
      expect(server.child.exitCode).toBeNull();
      const lines = body.split("\n").filter((line) => line.length > 0);
      const summary = JSON.parse(lines.at(-1) ?? "{}") as { __summary?: { items?: number } };
      expect(summary.__summary?.items).toBe(200);
      expect(lines).toHaveLength(201);
    } finally {
      server.child.kill("SIGTERM");
      await once(server.child, "exit").catch(() => undefined);
    }
  }, 180_000);

  it("ends an in-flight export and exits 0 within 5 seconds after SIGTERM", async () => {
    const server = await startServer();
    try {
      const port = server.port;
      const open = await session(port);
      const connectionId = await connect(port, open);
      const response = await beginExport(port, open, connectionId, "orders");
      const started = Date.now();
      const ended = new Promise<void>((resolve) => {
        response.on("error", () => {
          resolve();
        });
        response.on("close", () => {
          resolve();
        });
      });
      response.resume();
      server.child.kill("SIGTERM");
      await ended;
      const [code] = (await once(server.child, "exit")) as [number | null];
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(code).toBe(0);
    } finally {
      if (server.child.exitCode === null && server.child.signalCode === null) {
        server.child.kill("SIGTERM");
        await once(server.child, "exit").catch(() => undefined);
      }
    }
  });
});

function localClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: "us-east-1",
    endpoint: "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
}

async function waitUntilActive(client: DynamoDBClient, name: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const described = await client.send(new DescribeTableCommand({ TableName: name }));
    if (described.Table?.TableStatus === "ACTIVE") {
      return;
    }
    await delay(100);
  }
  throw new Error(`${name} did not become active.`);
}

async function writeLargeItems(client: DynamoDBClient, name: string): Promise<void> {
  const blob = "x".repeat(390 * 1024);
  for (let start = 0; start < 200; start += 8) {
    let pending: WriteRequest[] = Array.from({ length: Math.min(8, 200 - start) }, (_, offset) => ({
      PutRequest: {
        Item: {
          id: { S: `item-${String(start + offset).padStart(4, "0")}` },
          blob: { S: blob },
        },
      },
    }));
    for (let attempt = 0; pending.length > 0 && attempt < 8; attempt += 1) {
      const result = await client.send(
        new BatchWriteItemCommand({ RequestItems: { [name]: pending } }),
      );
      pending = result.UnprocessedItems?.[name] ?? [];
      if (pending.length > 0) {
        await delay(50 * (attempt + 1));
      }
    }
    if (pending.length > 0) {
      throw new Error(`Left ${String(pending.length)} items unwritten.`);
    }
  }
}

async function startServer(): Promise<{ child: ChildProcess; port: number; logs: Buffer[] }> {
  const home = mkdtempSync(join(tmpdir(), "ds-export-home-"));
  const port = await freePort();
  const logs: Buffer[] = [];
  const child = spawn(
    process.execPath,
    ["--max-old-space-size=128", "--import", "tsx", "apps/server/src/index.ts"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        LOG_LEVEL: "silent",
        NODE_ENV: "test",
        DYNAMO_STUDIO_HOME: home,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk: Buffer) => {
    logs.push(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    logs.push(chunk);
  });
  child.once("exit", () => {
    rmSync(home, { recursive: true, force: true });
  });
  await waitForHealth(port, child, logs);
  return { child, port, logs };
}

async function session(port: number): Promise<{ cookie: string; csrf: string }> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/session`);
  const line = response.headers.get("set-cookie");
  if (line === null) {
    throw new Error("missing set-cookie");
  }
  const body = (await response.json()) as { csrfToken: string };
  return { cookie: line.split(";")[0] ?? line, csrf: body.csrfToken };
}

async function connect(port: number, open: { cookie: string; csrf: string }): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/connections`, {
    method: "POST",
    headers: {
      cookie: open.cookie,
      [CSRF_HEADER]: open.csrf,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      endpoint: "http://127.0.0.1:8000",
      region: "us-east-1",
      auth: { type: "local" },
      env: "local",
      readOnly: true,
      remember: false,
    }),
  });
  if (response.status !== 201) {
    throw new Error(`Connect returned ${String(response.status)}.`);
  }
  const body = (await response.json()) as { connectionId: string };
  return body.connectionId;
}

function exportTable(
  port: number,
  open: { cookie: string; csrf: string },
  connectionId: string,
  table: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = exportRequest(port, open, connectionId, table);
    req.on("error", reject);
    req.on("response", (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        if ((response.statusCode ?? 0) !== 200) {
          reject(new Error(`Export returned ${String(response.statusCode)}.`));
          return;
        }
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
    req.end(JSON.stringify({ format: "ndjson", typed: true, scope: "all" }));
  });
}

function beginExport(
  port: number,
  open: { cookie: string; csrf: string },
  connectionId: string,
  table: string,
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = exportRequest(port, open, connectionId, table);
    req.on("error", reject);
    req.on("response", (response) => {
      resolve(response);
    });
    req.end(JSON.stringify({ format: "ndjson", typed: true, scope: "all" }));
  });
}

function exportRequest(
  port: number,
  open: { cookie: string; csrf: string },
  connectionId: string,
  table: string,
): ReturnType<typeof httpRequest> {
  return httpRequest({
    host: "127.0.0.1",
    port,
    path: `/api/v1/connections/${connectionId}/tables/${table}/export`,
    method: "POST",
    headers: {
      cookie: open.cookie,
      [CSRF_HEADER]: open.csrf,
      "content-type": "application/json",
    },
  });
}

async function waitForHealth(port: number, child: ChildProcess, logs: Buffer[]): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    if (child.exitCode !== null) {
      throw new Error(
        `Server exited ${String(child.exitCode)}: ${Buffer.concat(logs).toString("utf8")}`,
      );
    }
    try {
      const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The process is still binding its port.
    }
    await delay(100);
  }
  throw new Error(`Server did not start: ${Buffer.concat(logs).toString("utf8")}`);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        reject(new Error("missing port"));
        return;
      }
      const { port } = address;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
