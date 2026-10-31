import { spawn } from "node:child_process";
import { createReadStream, mkdtempSync, rmSync, statSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const image = process.env.DS_IMAGE ?? "dynamo-studio:local";
const name = `ds-smoke-${process.pid.toString(36)}`;
const targetBytes = 200 * 1024 * 1024;

async function main(): Promise<void> {
  const port = await freePort();
  const dir = mkdtempSync(join(tmpdir(), "ds-docker-"));
  const file = join(dir, "import.ndjson");
  try {
    await docker([
      "run",
      "-d",
      "--name",
      name,
      "--memory=512m",
      "--memory-swap=512m",
      "--add-host",
      "host.docker.internal:host-gateway",
      "-p",
      `127.0.0.1:${String(port)}:8080`,
      "-e",
      "HOST=0.0.0.0",
      "-e",
      "PORT=8080",
      image,
    ]);
    await waitForHealth(port);
    const user = (await docker(["exec", name, "id", "-u"])).trim();
    if (user === "0") {
      throw new Error("Container is running as root.");
    }
    await expectStatus(port, "/api/v1/health", {}, 200);
    await expectStatus(port, "/api/v1/health", { Host: "evil.example" }, 403);
    await expectStatus(port, "/api/v1/health", { Origin: "https://evil.example" }, 403);
    const logs = await docker(["logs", name]);
    if (!logs.includes("not loopback")) {
      throw new Error(`Missing the non-loopback startup warning.\n${logs}`);
    }
    await writeImportFile(file);
    const open = await session(port);
    const connectionId = await connect(port, open);
    const imported = await postImport(port, open, connectionId, file);
    if (imported.status !== 200 || !imported.text.includes('"type":"done"')) {
      throw new Error(`Import returned ${String(imported.status)}: ${imported.text.slice(0, 500)}`);
    }
    const oom = (await docker(["inspect", "--format", "{{.State.OOMKilled}}", name])).trim();
    if (oom !== "false") {
      throw new Error(`Container was OOMKilled: ${oom}`);
    }
    const bytes = Number(
      (await docker(["image", "inspect", "--format", "{{.Size}}", image])).trim(),
    );
    const mebibytes = Math.round(bytes / (1024 * 1024));
    process.stdout.write(
      `image ${image} ${String(bytes)} bytes (${String(mebibytes)} MiB)\nuser ${user}\nimport ${String(imported.status)} oom ${oom}\n`,
    );
  } finally {
    await docker(["rm", "-f", name]).catch(() => undefined);
    rmSync(dir, { recursive: true, force: true });
  }
}

function docker(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      out.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      err.push(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      const text = Buffer.concat([...out, ...err]).toString("utf8");
      if (code !== 0) {
        reject(new Error(`docker ${args[0] ?? ""} exited ${String(code)}: ${text}`));
        return;
      }
      resolve(text);
    });
  });
}

async function waitForHealth(port: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      if ((await statusOf(port, "/api/v1/health", {})) === 200) {
        return;
      }
    } catch {
      // The process is still binding its port.
    }
    await delay(200);
  }
  throw new Error(`Health did not come up.\n${await docker(["logs", name]).catch(() => "")}`);
}

async function expectStatus(
  port: number,
  path: string,
  headers: Record<string, string>,
  expected: number,
): Promise<void> {
  const status = await statusOf(port, path, headers);
  if (status !== expected) {
    throw new Error(`${path} returned ${String(status)}, expected ${String(expected)}.`);
  }
}

function statusOf(port: number, path: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port, path, method: "GET", headers },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    req.end();
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

async function connect(port: number, open: { cookie: string; csrf: string }): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${String(port)}/api/v1/connections`, {
    method: "POST",
    headers: {
      cookie: open.cookie,
      "x-ds-csrf": open.csrf,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      endpoint: "http://host.docker.internal:8000",
      region: "us-east-1",
      auth: { type: "local" },
      env: "local",
      readOnly: false,
      remember: false,
    }),
  });
  if (response.status !== 201) {
    throw new Error(`Connect returned ${String(response.status)} ${await response.text()}`);
  }
  const body = (await response.json()) as { connectionId: string };
  return body.connectionId;
}

function postImport(
  port: number,
  open: { cookie: string; csrf: string },
  connectionId: string,
  path: string,
): Promise<{ status: number; text: string }> {
  const boundary = "----dsdocker";
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
          "x-ds-csrf": open.csrf,
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            text: Buffer.concat(chunks).toString("utf8"),
          });
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

function writeImportFile(path: string): Promise<void> {
  const writer = `
import { createWriteStream } from "node:fs";
import { once } from "node:events";
const stream = createWriteStream(process.env.DS_FILE);
const pad = "x".repeat(256 * 1024);
const line = Buffer.concat([
  Buffer.from('{"id":{"S":"1"},"pad":{"S":"'),
  Buffer.from(pad),
  Buffer.from('"}}\\n'),
]);
let written = 0;
const target = Number(process.env.DS_BYTES);
while (written < target) {
  if (!stream.write(line)) await once(stream, "drain");
  written += line.byteLength;
}
stream.end();
await once(stream, "finish");
`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", writer], {
    env: { ...process.env, DS_FILE: path, DS_BYTES: String(targetBytes) },
    stdio: "inherit",
  });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`File writer exited ${String(code)}.`));
        return;
      }
      if (statSync(path).size < targetBytes) {
        reject(new Error("Import file is shorter than 200 MB."));
        return;
      }
      resolve();
    });
  });
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
      const chosen = address.port === 8080 ? 18081 : address.port;
      probe.close(() => {
        resolve(chosen);
      });
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "docker smoke failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
