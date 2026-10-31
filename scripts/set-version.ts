import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const version = process.argv[2];
if (version === undefined || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/.test(version)) {
  process.stderr.write("Usage: tsx scripts/set-version.ts <semver>\n");
  process.exitCode = 1;
} else {
  const root = JSON.parse(readFileSync("package.json", "utf8")) as { private?: boolean };
  if (root.private !== true) {
    throw new Error("The root package must stay private.");
  }
  for (const file of [
    "package.json",
    "apps/web/package.json",
    "apps/server/package.json",
    "packages/shared/package.json",
  ]) {
    const path = join(process.cwd(), file);
    const text = readFileSync(path, "utf8");
    const next = text.replace(/"version": "[^"]+"/, `"version": "${version}"`);
    if (next === text) {
      throw new Error(`No version field in ${file}`);
    }
    writeFileSync(path, next);
  }
  process.stdout.write(`${version}\n`);
}
