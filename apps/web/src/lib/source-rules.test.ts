import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("source rules", () => {
  it("does not use !important in the web app", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const files = walk(root);
    const hits = files.filter((file) => readFileSync(file, "utf8").includes("!important"));
    expect(hits).toEqual([]);
  });
});

function walk(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    if (name === "node_modules" || name === "dist") {
      return [];
    }
    const child = join(path, name);
    if (statSync(child).isDirectory()) {
      return walk(child);
    }
    if (/\.(ts|tsx|css)$/.test(name) && !name.includes(".test.")) {
      return [child];
    }
    return [];
  });
}
