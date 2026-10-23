import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const budget = 250 * 1024;
const assetsDir = "apps/web/dist/assets";

const names = await readdir(assetsDir);
const scripts = names.filter((name) => name.endsWith(".js"));
if (scripts.length === 0) {
  process.stderr.write("No JavaScript assets were built in apps/web/dist/assets\n");
  process.exit(1);
}

let total = 0;
for (const name of scripts) {
  const source = await readFile(join(assetsDir, name));
  total += gzipSync(source).byteLength;
}

process.stdout.write(`Web JavaScript gzip: ${String(total)} bytes (budget ${String(budget)})\n`);
if (total > budget) {
  process.stderr.write("Web JavaScript exceeds the 250 KB gzip budget\n");
  process.exit(1);
}
