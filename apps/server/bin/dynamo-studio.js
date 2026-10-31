#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const oldSpace = "--max-old-space-size=128";

if (!process.execArgv.includes(oldSpace)) {
  const child = spawn(process.execPath, [oldSpace, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal !== null) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
} else if (process.env.DYNAMO_STUDIO_ARGV_CHECK === "1") {
  process.stdout.write(`${process.execArgv.join(" ")}\n`);
  process.exit(0);
} else {
  const loaded = await import(resolveEntry());
  await loaded.startStudio();
}

function resolveEntry() {
  const candidates = [
    new URL("../dist/cli.js", import.meta.url),
    new URL("../apps/server/dist/cli.js", import.meta.url),
  ];
  for (const candidate of candidates) {
    if (existsSync(fileURLToPath(candidate))) {
      return candidate.href;
    }
  }
  process.stderr.write("DynamoDB Studio is not built. Run pnpm build and try again.\n");
  process.exit(1);
}
