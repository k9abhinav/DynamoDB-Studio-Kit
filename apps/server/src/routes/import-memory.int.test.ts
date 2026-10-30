import { createReadStream, createWriteStream, statSync, unlinkSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { describe, expect, it } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";
import { buildApp } from "../app.js";

function collectGarbage(): void {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (gc !== undefined) {
    gc();
  }
}

async function writeImportFile(path: string, bytes: number): Promise<void> {
  const stream = createWriteStream(path);
  const line = Buffer.from(`{"id":{"S":"1"},"pad":{"S":"${"x".repeat(256 * 1024)}"}}\n`);
  let written = 0;
  while (written < bytes) {
    if (!stream.write(line)) {
      await once(stream, "drain");
    }
    written += line.byteLength;
  }
  stream.end();
  await once(stream, "finish");
}

function framing(boundary: string): { head: Buffer; tail: Buffer } {
  return {
    head: Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="options"\r\n\r\n{"format":"ndjson","mode":"put","dryRun":true}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="big.ndjson"\r\nContent-Type: application/x-ndjson\r\n\r\n`,
    ),
    tail: Buffer.from(`\r\n--${boundary}--\r\n`),
  };
}

describe("import memory", () => {
  it("does not retain a generated file larger than 100 MB after the import", async () => {
    const path = join(tmpdir(), `ds-import-${String(Date.now())}.ndjson`);
    const app = await buildApp();
    const boundary = "----dsmemory";
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      await writeImportFile(path, 100 * 1024 * 1024 + 1);
      const fileBytes = statSync(path).size;
      const open = await app.inject({ method: "GET", url: "/api/v1/session" });
      const cookieHeader = open.headers["set-cookie"];
      const cookieLine = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
      const cookie = cookieLine?.split(";")[0];
      const csrf = open.json<{ csrfToken: string }>().csrfToken;
      if (cookie === undefined) {
        throw new Error("missing cookie");
      }
      const headers = { cookie, [CSRF_HEADER]: csrf };
      const connected = await app.inject({
        method: "POST",
        url: "/api/v1/connections",
        headers,
        payload: {
          endpoint: "http://127.0.0.1:8000",
          region: "us-east-1",
          auth: { type: "local" },
          env: "local",
          readOnly: false,
          remember: false,
        },
      });
      const connectionId = connected.json<{ connectionId: string }>().connectionId;
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address();
      if (address === null || typeof address === "string") {
        throw new Error("missing port");
      }
      const parts = framing(boundary);
      collectGarbage();
      const before = process.memoryUsage();
      let peak = before.rss;
      timer = setInterval(() => {
        peak = Math.max(peak, process.memoryUsage().rss);
      }, 20);
      const response = await new Promise<{ status: number; text: string }>((resolve, reject) => {
        const req = httpRequest(
          {
            host: "127.0.0.1",
            port: address.port,
            path: `/api/v1/connections/${connectionId}/tables/users/import`,
            method: "POST",
            headers: {
              ...headers,
              "content-type": `multipart/form-data; boundary=${boundary}`,
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });
            res.on("end", () => {
              resolve({
                status: res.statusCode ?? 0,
                text: Buffer.concat(chunks).toString("utf8"),
              });
            });
          },
        );
        req.on("error", reject);
        req.write(parts.head);
        const file = createReadStream(path);
        file.on("error", reject);
        file.pipe(req, { end: false });
        file.on("end", () => {
          req.end(parts.tail);
        });
      });
      clearInterval(timer);
      collectGarbage();
      const after = process.memoryUsage();
      const retained = after.rss - before.rss;
      writeFileSync(
        join(tmpdir(), "ds-import-rss.json"),
        JSON.stringify({
          fileBytes,
          before,
          after,
          peak,
          retained,
          status: response.status,
        }),
      );
      expect(typeof (globalThis as { gc?: unknown }).gc).toBe("function");
      expect(response.status).toBe(200);
      expect(response.text).toContain('"type":"done"');
      const live = after.heapUsed + after.external - (before.heapUsed + before.external);
      expect(live).toBeLessThan(fileBytes / 4);
      expect(live).toBeLessThan(40 * 1024 * 1024);
    } finally {
      if (timer !== undefined) {
        clearInterval(timer);
      }
      await app.close();
      unlinkSync(path);
    }
  }, 60_000);
});
