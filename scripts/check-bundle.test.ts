import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { INITIAL_JS_BUDGET, initialJavaScriptGzip, initialScriptPaths } from "./check-bundle.js";

describe("initial JavaScript budget", () => {
  let directory = "";

  afterEach(async () => {
    if (directory.length > 0) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps the early budget at 230 KB", () => {
    expect(INITIAL_JS_BUDGET).toBe(230 * 1024);
  });

  it("reads entry scripts and modulepreloads, not other chunks", () => {
    const html = [
      '<script type="module" crossorigin src="/assets/index.js"></script>',
      '<link rel="modulepreload" crossorigin href="/assets/shared.js">',
      '<link rel="stylesheet" href="/assets/index.css">',
    ].join("");
    expect(initialScriptPaths(html)).toEqual(["assets/index.js", "assets/shared.js"]);
  });

  it("gzips only the scripts linked from index.html", async () => {
    directory = await mkdtemp(join(tmpdir(), "bundle-initial-"));
    await mkdir(join(directory, "assets"));
    const entry = "entry-module";
    const lazy = "lazy-route-module";
    await writeFile(
      join(directory, "index.html"),
      '<script type="module" src="/assets/index.js"></script>',
    );
    await writeFile(join(directory, "assets", "index.js"), entry);
    await writeFile(join(directory, "assets", "ConnectScreen.js"), lazy);
    await expect(initialJavaScriptGzip(directory)).resolves.toBe(gzipSync(entry).byteLength);
  });
});
