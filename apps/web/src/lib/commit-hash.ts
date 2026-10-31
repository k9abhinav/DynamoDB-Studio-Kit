import { execFileSync } from "node:child_process";

export function readCommitHash(
  run: (command: string, args: readonly string[]) => string = defaultRun,
): string {
  try {
    const hash = run("git", ["rev-parse", "--short", "HEAD"]).trim();
    return hash.length > 0 ? hash : "unknown";
  } catch {
    return "unknown";
  }
}

function defaultRun(command: string, args: readonly string[]): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}
