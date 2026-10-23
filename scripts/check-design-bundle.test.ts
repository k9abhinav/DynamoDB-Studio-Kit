import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findDesignLeaks } from "./check-design-bundle.js";

describe("findDesignLeaks", () => {
  let directory = "";

  afterEach(async () => {
    if (directory.length > 0) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a bundle that mentions the design route", async () => {
    directory = await mkdtemp(join(tmpdir(), "design-leak-"));
    await writeFile(join(directory, "app.js"), 'const path = "/__design";');
    await expect(findDesignLeaks(directory)).resolves.toEqual([
      expect.stringContaining("contains /__design"),
    ]);
  });

  it("accepts a bundle without the gallery", async () => {
    directory = await mkdtemp(join(tmpdir(), "design-clean-"));
    await mkdir(join(directory, "assets"));
    await writeFile(join(directory, "assets", "index.js"), "console.info('studio');");
    await expect(findDesignLeaks(directory)).resolves.toEqual([]);
  });
});
