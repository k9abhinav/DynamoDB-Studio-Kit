import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { deleteLocalTables, uniqueToken } from "../apps/server/src/local-cleanup.js";
import { ensureDir, readUtf8 } from "../apps/server/src/test-files.js";
import { isSerious } from "./axe.js";
import { connectLocal } from "./session.js";

test("creates a table, imports a CSV, queries, exports, and deletes it", async ({ page }) => {
  test.setTimeout(90_000);
  const name = `p7${uniqueToken()}`;
  await page.setViewportSize({ width: 1440, height: 900 });
  const connectionId = await connectLocal(page);
  try {
    await page.goto(`/c/${connectionId}`);
    await page.getByRole("button", { name: "Create table" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "Table name" }).focus();
    await page.keyboard.type(name);
    await page.getByRole("textbox", { name: "Partition key" }).focus();
    await page.keyboard.type("id");
    await expect(page.getByText("Name is available.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
    await page.getByRole("button", { name: "Next" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "TTL attribute" }).fill("expiresAt");
    await page.getByRole("textbox", { name: "Index name" }).fill("kind-index");
    await page.getByRole("textbox", { name: "Index partition key" }).fill("kind");
    await page.getByRole("button", { name: "Next" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Create" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Enabled on expiresAt")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("kind-index", { exact: true }).first()).toBeVisible();

    await page.getByRole("tab", { name: "Items" }).click();
    await page.getByRole("button", { name: "Table actions" }).click();
    await page.getByRole("menuitem", { name: "Import" }).click();
    await page.getByLabel("Import file").setInputFiles("e2e/fixtures/notes.csv");
    await expect(page.getByText("007 stays a string")).toBeVisible();
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Import items" }).getByText("Import finished."),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Dismiss" }).click();

    await page.getByRole("button", { name: "Query" }).click();
    await page.getByRole("textbox", { name: "id" }).fill("a");
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByText("hello")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Table actions" }).click();
    await page.getByRole("menuitem", { name: "Export" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${name}.ndjson`);
    expect(await readUtf8(await download.path())).toContain("hello");
    await page.getByRole("button", { name: "Dismiss" }).click();

    await page.getByRole("tab", { name: "Overview" }).click();
    await page.getByRole("button", { name: "Table actions" }).click();
    await page.getByRole("menuitem", { name: "Delete table" }).click();
    await expect(page.getByText("This deletes the table.")).toBeVisible();
    await page.getByRole("textbox", { name: `Type ${name} to confirm` }).fill(name);
    await page.getByRole("button", { name: "Delete table" }).click();
    await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
  } finally {
    await deleteLocalTables([name]);
  }
});

test("read-only connection disables create, import, clear, and delete", async ({ page }) => {
  const connectionId = await connectLocal(page, "http://127.0.0.1:8000", true);
  await page.goto(`/c/${connectionId}/t/orders/overview`);
  await expect(page.getByRole("button", { name: "Create table" })).toBeDisabled();
  await page.getByRole("button", { name: "Table actions" }).click();
  for (const label of ["Import", "Clear table", "Delete table"]) {
    await expect(page.getByRole("menuitem", { name: label })).toBeDisabled();
  }
  await expect(page.getByRole("menuitem", { name: "Export" })).toBeEnabled();
});

for (const scheme of ["light", "dark"] as const) {
  test(`table actions axe and screenshots in ${scheme}`, async ({ page }) => {
    await shoot(page, scheme);
  });
}

async function shoot(page: Page, scheme: "light" | "dark"): Promise<void> {
  await ensureDir("docs/screenshots/phase-7");
  await page.addInitScript((value) => {
    localStorage.setItem("mui-mode", value);
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1440, height: 900 });
  const connectionId = await connectLocal(page);
  await page.goto(`/c/${connectionId}/t/orders/overview`);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.screenshot({ path: `docs/screenshots/phase-7/overview-${scheme}.png` });
  await expectClean(page);

  await page.getByRole("button", { name: "Create table" }).click();
  const wizard = page.getByRole("dialog", { name: "Create table" });
  await expect(wizard).toHaveCSS("opacity", "1");
  await expect
    .poll(() =>
      page.locator(".MuiDialog-root").evaluate((element) => getComputedStyle(element).opacity),
    )
    .toBe("1");
  await page.screenshot({ path: `docs/screenshots/phase-7/create-wizard-${scheme}.png` });
  await expectClean(page);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Table actions" }).click();
  await page.getByRole("menuitem", { name: "Import" }).click();
  await expect(page.getByRole("menu")).toBeHidden();
  const importer = page.getByRole("dialog", { name: "Import items" });
  await expect(importer).toHaveCSS("opacity", "1");
  await page.screenshot({ path: `docs/screenshots/phase-7/import-${scheme}.png` });
  await expectClean(page);
}

async function expectClean(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);
}
