import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const forbidden = ["/__design", "Design gallery", "DesignGallery"];

export async function findDesignLeaks(root: string): Promise<string[]> {
  const leaks: string[] = [];
  await walk(root, leaks);
  return leaks;
}

async function walk(dir: string, leaks: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path, leaks);
      continue;
    }
    if (forbidden.some((token) => entry.name.includes(token))) {
      leaks.push(path);
    }
    if (
      !entry.name.endsWith(".js") &&
      !entry.name.endsWith(".css") &&
      !entry.name.endsWith(".html")
    ) {
      continue;
    }
    const text = await readFile(path, "utf8");
    const hit = forbidden.find((token) => text.includes(token));
    if (hit !== undefined) {
      leaks.push(`${path} contains ${hit}`);
    }
  }
}

const entry = process.argv[1];
if (entry !== undefined && fileURLToPath(import.meta.url) === entry) {
  const leaks = await findDesignLeaks("apps/web/dist");
  if (leaks.length > 0) {
    process.stderr.write(
      `Design gallery leaked into the production bundle:\n${leaks.join("\n")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("Production bundle omits /__design\n");
}
