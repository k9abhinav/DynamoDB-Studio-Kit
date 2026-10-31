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
    if (!/"version": "[^"]+"/.test(text)) {
      throw new Error(`No version field in ${file}`);
    }
    const next = text.replace(/"version": "[^"]+"/, `"version": "${version}"`);
    if (next !== text) {
      writeFileSync(path, next);
    }
  }
  const about = join(process.cwd(), "apps/web/src/components/AboutDialog.tsx");
  const aboutText = readFileSync(about, "utf8");
  if (!/export const APP_VERSION = "[^"]+"/.test(aboutText)) {
    throw new Error("About dialog is missing APP_VERSION");
  }
  const aboutNext = aboutText.replace(
    /export const APP_VERSION = "[^"]+"/,
    `export const APP_VERSION = "${version}"`,
  );
  if (aboutNext !== aboutText) {
    writeFileSync(about, aboutNext);
  }
  process.stdout.write(`${version}\n`);
}
