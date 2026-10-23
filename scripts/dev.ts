import { spawn, type ChildProcess } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function start(args: string[]): ChildProcess {
  const child = spawn(pnpm, args, { stdio: "inherit" });
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      shutdown(code);
    }
  });
  return child;
}

const children = [
  start(["--filter", "@dynamo-studio/server", "dev"]),
  start(["--filter", "@dynamo-studio/web", "dev"]),
];

function shutdown(code = 0): void {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => {
  shutdown(0);
});
process.on("SIGTERM", () => {
  shutdown(0);
});
