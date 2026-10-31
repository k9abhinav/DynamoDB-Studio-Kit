import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

export const OLD_SPACE_ARG = "--max-old-space-size=128";

export interface CliOptions {
  port?: string;
  host?: string;
  home?: string;
  open: boolean;
}

export function parseCliArgs(args: readonly string[]): CliOptions {
  const { values } = parseArgs({
    args: [...args],
    strict: true,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      home: { type: "string" },
      open: { type: "boolean", default: false },
    },
  });
  const options: CliOptions = { open: values.open };
  if (values.port !== undefined) {
    options.port = values.port;
  }
  if (values.host !== undefined) {
    options.host = values.host;
  }
  if (values.home !== undefined) {
    options.home = values.home;
  }
  return options;
}

export function applyCliEnv(options: CliOptions, env: NodeJS.ProcessEnv): void {
  if (options.port !== undefined) {
    env.PORT = options.port;
  }
  if (options.host !== undefined) {
    env.HOST = options.host;
  }
  if (options.home !== undefined) {
    env.DYNAMO_STUDIO_HOME = options.home;
  }
  env.NODE_ENV = "production";
}

export function portInUseMessage(port: string): string {
  return `Port ${port} is already in use. Stop the other process, or start again with --port and a free port.`;
}

export function studioUrl(host: string, port: string): string {
  const shown = host.includes(":") ? `[${host}]` : host;
  return `http://${shown}:${port}`;
}

export function isAddrInUse(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("code" in error && error.code === "EADDRINUSE") {
    return true;
  }
  return "cause" in error ? isAddrInUse(error.cause) : false;
}

export async function startStudio(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  applyCliEnv(options, process.env);
  try {
    await import("./index.js");
  } catch (error) {
    if (isAddrInUse(error)) {
      process.stderr.write(`${portInUseMessage(process.env.PORT ?? "8080")}\n`);
      process.exit(1);
    }
    throw error;
  }
  const host = process.env.HOST ?? "127.0.0.1";
  const port = process.env.PORT ?? "8080";
  const url = studioUrl(host, port);
  process.stdout.write(`DynamoDB Studio is at ${url}\n`);
  if (options.open) {
    openBrowser(url);
  }
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => undefined);
  child.unref();
}
