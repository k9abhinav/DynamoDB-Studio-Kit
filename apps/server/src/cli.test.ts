import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  applyCliEnv,
  isAddrInUse,
  OLD_SPACE_ARG,
  parseCliArgs,
  portInUseMessage,
  studioUrl,
} from "./cli.js";

const bin = fileURLToPath(new URL("../bin/dynamo-studio.js", import.meta.url));

describe("parseCliArgs", () => {
  it("reads port, host, home, and open", () => {
    expect(
      parseCliArgs(["--port", "9000", "--host", "127.0.0.1", "--home", "/tmp/studio", "--open"]),
    ).toEqual({
      port: "9000",
      host: "127.0.0.1",
      home: "/tmp/studio",
      open: true,
    });
  });

  it("leaves the optional flags unset", () => {
    expect(parseCliArgs([])).toEqual({ open: false });
  });
});

describe("applyCliEnv", () => {
  it("copies the flags into the environment and forces production", () => {
    const env: NodeJS.ProcessEnv = {};
    applyCliEnv({ port: "9000", host: "127.0.0.1", home: "/tmp/studio", open: false }, env);
    expect(env).toMatchObject({
      PORT: "9000",
      HOST: "127.0.0.1",
      DYNAMO_STUDIO_HOME: "/tmp/studio",
      NODE_ENV: "production",
    });
  });
});

describe("port in use", () => {
  it("names the port and suggests --port", () => {
    expect(portInUseMessage("8080")).toBe(
      "Port 8080 is already in use. Stop the other process, or start again with --port and a free port.",
    );
    expect(isAddrInUse({ code: "EADDRINUSE" })).toBe(true);
    expect(isAddrInUse({ cause: { code: "EADDRINUSE" } })).toBe(true);
    expect(isAddrInUse(new Error("nope"))).toBe(false);
  });
});

describe("studioUrl", () => {
  it("brackets ipv6 hosts", () => {
    expect(studioUrl("::1", "8080")).toBe("http://[::1]:8080");
    expect(studioUrl("127.0.0.1", "8080")).toBe("http://127.0.0.1:8080");
  });
});

describe("dynamo-studio process", () => {
  beforeAll(() => {
    execFileSync("pnpm", ["--filter", "@dynamo-studio/server", "build"], { stdio: "ignore" });
  }, 60_000);

  it("re-execs with the old-space cap in the process arguments", async () => {
    const output = await runBin(["--port", "9"], { DYNAMO_STUDIO_ARGV_CHECK: "1" });
    expect(output.stdout).toContain(OLD_SPACE_ARG);
    expect(output.code).toBe(0);
  });

  it("prints a friendly error when the port is taken", async () => {
    const blocker = createServer();
    await new Promise<void>((resolve) => {
      blocker.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });
    const address = blocker.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected a TCP port.");
    }
    try {
      const output = await runBin(["--port", String(address.port), "--host", "127.0.0.1"]);
      expect(output.stderr).toContain(portInUseMessage(String(address.port)));
      expect(output.code).toBe(1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        blocker.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  }, 20_000);
});

function runBin(
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env: { ...process.env, ...extraEnv },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, 15_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}
