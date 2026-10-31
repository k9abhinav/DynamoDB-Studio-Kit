import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { createReadStream, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const SAMPLE_MS = 500;
const FILE_WRITER = `
import { createWriteStream } from "node:fs";
import { once } from "node:events";
const path = process.env.DS_RSS_FILE;
const bytes = Number(process.env.DS_RSS_BYTES);
if (path === undefined || !Number.isFinite(bytes)) {
  process.exit(1);
}
const stream = createWriteStream(path);
const pad = "x".repeat(256 * 1024);
const line = Buffer.concat([
  Buffer.from('{"id":{"S":"1"},"pad":{"S":"'),
  Buffer.from(pad),
  Buffer.from('"}}'),
  Buffer.from([10]),
]);
let written = 0;
while (written < bytes) {
  if (!stream.write(line)) {
    await once(stream, "drain");
  }
  written += line.byteLength;
}
stream.end();
await once(stream, "finish");
`;

interface MemorySample {
  rss: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

interface ImportSample {
  fileBytes: number;
  beforeRss: number;
  peakRss: number;
  afterRss: number;
  beforeHeap: number;
  afterHeap: number;
  beforeExternal: number;
  afterExternal: number;
  samples: number;
  processed: number;
}

const SIZES_MB = [50, 100, 200, 400] as const;

describe("import memory", () => {
  it("keeps a fresh server's RSS flat from 50 MB through 400 MB", async () => {
    const runs: ImportSample[] = [];
    for (const megabytes of SIZES_MB) {
      runs.push(await importOnFreshServer(megabytes));
    }
    const report = JSON.stringify({ runs });
    writeFileSync(join(tmpdir(), "ds-import-rss.json"), report);
    const peaks = runs.map((run) => run.peakRss);
    const after = runs.map((run) => run.afterRss);
    const peakSpread = Math.max(...peaks) - Math.min(...peaks);
    const afterSpread = Math.max(...after) - Math.min(...after);
    for (const run of runs) {
      expect(run.samples, report).toBeGreaterThan(0);
      expect(run.processed, report).toBeGreaterThan(run.fileBytes / (256 * 1024) - 2);
      expect(Math.abs(run.afterHeap - run.beforeHeap), report).toBeLessThan(16 * 1024 * 1024);
    }
    expect(peakSpread, report).toBeLessThan(64 * 1024 * 1024);
    expect(afterSpread, report).toBeLessThan(64 * 1024 * 1024);
  }, 300_000);
});

async function importOnFreshServer(megabytes: number): Promise<ImportSample> {
  const home = mkdtempSync(join(tmpdir(), "ds-rss-home-"));
  const dir = mkdtempSync(join(tmpdir(), "ds-rss-file-"));
  const port = await freePort();
  const logs: Buffer[] = [];
  const server = spawn(
    process.execPath,
    ["--max-old-space-size=128", "--expose-gc", "--import", "tsx", "apps/server/src/index.ts"],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        LOG_LEVEL: "silent",
        NODE_ENV: "test",
        DS_GC_PROBE: "1",
        DYNAMO_STUDIO_HOME: home,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk: Buffer) => {
    logs.push(chunk);
  });
  server.stderr.on("data", (chunk: Buffer) => {
    logs.push(chunk);
  });
  try {
    await waitForHealth(port, server, logs);
    const open = await session(port);
    const connectionId = await connect(port, open, "http://127.0.0.1:8000");
    return await measure(port, open, connectionId, server.pid, join(dir, "file.ndjson"), megabytes);
  } finally {
    server.kill("SIGTERM");
    await once(server, "exit").catch(() => undefined);
    rmSync(dir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
}

async function measure(
  port: number,
  open: { cookie: string; csrf: string },
  connectionId: string,
  pid: number | undefined,
  path: string,
  megabytes: number,
): Promise<ImportSample> {
  if (pid === undefined) {
    throw new Error("The server process has no pid.");
  }
  await writeFileInChild(path, megabytes * 1024 * 1024 + 1);
  const fileBytes = statSync(path).size;
  const before = await gcSample(port, open.cookie, true);
  let samples = 0;
  let peakRss = before.rss;
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    samples += 1;
    pending = rssBytes(pid).then((value) => {
      peakRss = Math.max(peakRss, value);
    });
  }, SAMPLE_MS);
  let responseText = "";
  try {
    const response = await postImport(port, open, connectionId, path);
    responseText = response.text;
    expect(response.status).toBe(200);
    expect(response.text).toContain('"type":"done"');
    expect(response.text).toContain('"written":0');
  } finally {
    clearInterval(timer);
    await pending;
  }
  const last = await rssBytes(pid);
  peakRss = Math.max(peakRss, last);
  const after = await gcSample(port, open.cookie, true);
  peakRss = Math.max(peakRss, after.rss);
  return {
    fileBytes,
    beforeRss: before.rss,
    peakRss,
    afterRss: after.rss,
    beforeHeap: before.heapUsed,
    afterHeap: after.heapUsed,
    beforeExternal: before.external,
    afterExternal: after.external,
    samples,
    processed: Number(/"processed":(\d+)/.exec(responseText)?.[1] ?? -1),
  };
}

function writeFileInChild(path: string, bytes: number): Promise<void> {
  const child = spawn(process.execPath, ["--input-type=module", "-e", FILE_WRITER], {
    env: { ...process.env, DS_RSS_FILE: path, DS_RSS_BYTES: String(bytes) },
    stdio: ["ignore", "inherit", "inherit"],
  });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`File writer exited ${String(code)}.`));
      }
    });
  });
}

function rssBytes(pid: number): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile("ps", ["-o", "rss=", "-p", String(pid)], (error, stdout) => {
      if (error !== null) {
        reject(new Error("ps failed", { cause: error }));
        return;
      }
      const kb = Number(stdout.trim());
      if (!Number.isFinite(kb)) {
        reject(new Error("ps did not return RSS."));
        return;
      }
      resolve(kb * 1024);
    });
  });
}

async function gcSample(port: number, cookie: string, collect: boolean): Promise<MemorySample> {
  const response = await fetch(
    `http://127.0.0.1:${String(port)}/api/v1/__gc?collect=${collect ? "1" : "0"}`,
    {
      headers: { cookie },
    },
  );
  if (!response.ok) {
    throw new Error(`GC probe returned ${String(response.status)}.`);
  }
  return (await response.json()) as MemorySample;
}

function postImport(
  port: number,
  open: { cookie: string; csrf: string },
  connectionId: string,
  path: string,
): Promise<{ status: number; text: string }> {
  const boundary = "----dsmemory";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="options"\r\n\r\n{"format":"ndjson","mode":"put","dryRun":true}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.ndjson"\r\nContent-Type: application/x-ndjson\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: `/api/v1/connections/${connectionId}/tables/users/import`,
        method: "POST",
        headers: {
          cookie: open.cookie,
          [CSRF_HEADER]: open.csrf,
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    req.on("error", reject);
    req.write(head);
    const file = createReadStream(path);
    file.on("error", reject);
    file.pipe(req, { end: false });
    file.on("end", () => {
      req.end(tail);
    });
  });
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

async function connect(
  port: number,
  open: { cookie: string; csrf: string },
  endpoint: string,
): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/connections`, {
    method: "POST",
    headers: {
      cookie: open.cookie,
      [CSRF_HEADER]: open.csrf,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      endpoint,
      region: "us-east-1",
      auth: { type: "local" },
      env: "local",
      readOnly: false,
      remember: false,
    }),
  });
  if (response.status !== 201) {
    throw new Error(`Connect returned ${String(response.status)}.`);
  }
  const body = (await response.json()) as { connectionId: string };
  return body.connectionId;
}

async function waitForHealth(
  port: number,
  server: { exitCode: number | null },
  logs: Buffer[],
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    if (server.exitCode !== null) {
      throw new Error(
        `Server exited ${String(server.exitCode)}: ${Buffer.concat(logs).toString("utf8")}`,
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
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
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
