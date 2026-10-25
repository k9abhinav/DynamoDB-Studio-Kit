import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

/** 230 KiB. The Phase 8 ceiling stays 250 KiB in check-bundle-size.ts. */
export const INITIAL_JS_BUDGET = 230 * 1024;

const scriptPattern = /<(?:script\b[^>]*\ssrc|link\b[^>]*\shref)="([^"]+\.js)"/g;

export function initialScriptPaths(html: string): string[] {
  const paths: string[] = [];
  for (const match of html.matchAll(scriptPattern)) {
    const src = match[1];
    if (src === undefined) {
      continue;
    }
    paths.push(src.startsWith("/") ? src.slice(1) : src);
  }
  return paths;
}

export async function initialJavaScriptGzip(distDir: string): Promise<number> {
  const html = await readFile(join(distDir, "index.html"), "utf8");
  const paths = initialScriptPaths(html);
  if (paths.length === 0) {
    throw new Error(`No initial script in ${join(distDir, "index.html")}`);
  }
  let total = 0;
  for (const path of paths) {
    const source = await readFile(join(distDir, path));
    total += gzipSync(source).byteLength;
  }
  return total;
}

export async function entryImportsMonaco(distDir: string): Promise<boolean> {
  const html = await readFile(join(distDir, "index.html"), "utf8");
  for (const path of initialScriptPaths(html)) {
    const source = await readFile(join(distDir, path), "utf8");
    if (source.includes("monaco-editor") || source.includes("MonacoEnvironment")) {
      return true;
    }
  }
  return false;
}

export function initialBudgetMessage(bytes: number, budget = INITIAL_JS_BUDGET): string {
  return `Initial JavaScript gzip: ${String(bytes)} bytes (budget ${String(budget)})`;
}

const entry = process.argv[1];
if (entry !== undefined && fileURLToPath(import.meta.url) === entry) {
  const bytes = await initialJavaScriptGzip("apps/web/dist");
  process.stdout.write(`${initialBudgetMessage(bytes)}\n`);
  if (await entryImportsMonaco("apps/web/dist")) {
    process.stderr.write("Monaco is in the initial JavaScript entry\n");
    process.exit(1);
  }
  if (bytes > INITIAL_JS_BUDGET) {
    process.stderr.write("Initial JavaScript exceeds the 230 KB gzip budget\n");
    process.exit(1);
  }
}
