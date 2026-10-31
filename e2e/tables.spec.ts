import {
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { createLocalClient } from "../scripts/seed-data.js";
import { deleteLocalTables, uniqueToken } from "../apps/server/src/local-cleanup.js";
import { isSerious } from "./axe.js";
import { connectLocal, openWorkspace } from "./session.js";

function generatedNames(prefix: string): string[] {
  return Array.from({ length: 300 }, (_unused, index) => {
    return `${prefix}${String(index).padStart(3, "0")}`;
  });
}

async function ensureTable(client: DynamoDBClient, name: string): Promise<void> {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: name,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      }),
    );
  } catch (error) {
    if (!(error instanceof ResourceInUseException)) {
      throw error;
    }
  }
}

test("searches seed tables and opens orders from the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page, "");
  const search = page.getByRole("searchbox", { name: "Filter tables" });
  await expect(page.getByRole("option", { name: "users" })).toBeVisible();
  await search.fill("ord");
  await expect(page.getByRole("option", { name: "orders" })).toBeVisible();
  await expect(page.getByRole("option", { name: "users" })).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/t\/orders\/items$/);
  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page.getByText("userId")).toBeVisible();
  await expect(page.getByText("status-createdAt-index", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "About this count" }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Approximate");
  await page.getByRole("tab", { name: "Indexes" }).click();
  await expect(page.getByText("This index is still backfilling.")).toHaveCount(0);
  await page.getByRole("button", { name: "Close orders" }).click();
  await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
});

test("deep-links overview, sessions TTL, a dotted name, and a missing table", async ({ page }) => {
  const name = `my.table-${uniqueToken()}`;
  const client = createLocalClient();
  try {
    await ensureTable(client, name);
    const connectionId = await connectLocal(page);
    await page.goto(`/c/${connectionId}/t/orders/overview`);
    await expect(page.getByRole("heading", { name: "Keys" })).toBeVisible();
    await expect(page.getByText("createdAt").first()).toBeVisible();
    await page.goto(`/c/${connectionId}/t/sessions/overview`);
    await expect(page.getByText("Enabled on expiresAt")).toBeVisible();
    await page.goto(`/c/${connectionId}/t/${encodeURIComponent(name)}/overview`);
    await expect(page.getByRole("option", { name })).toBeVisible();
    await expect(page.getByText(`table/${name}`)).toBeVisible();
    await page.goto(`/c/${connectionId}/t/missing-table/overview`);
    await expect(page.getByText("That table doesn't exist (anymore).")).toBeVisible();
    await page.getByRole("button", { name: "Back to tables" }).click();
    await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
  } finally {
    client.destroy();
    await deleteLocalTables([name]);
  }
});

test("scrolls, searches, and keyboard-navigates a few hundred tables", async ({ page }) => {
  test.setTimeout(180_000);
  const prefix = `zz${uniqueToken()}-`;
  const names = generatedNames(prefix);
  const last = `${prefix}299`;
  const client = createLocalClient();
  try {
    for (const name of names) {
      await ensureTable(client, name);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, "");
    await expect(page.getByRole("option", { name: "users" })).toBeVisible();
    const loading = page.getByLabel("Loading more tables");
    await loading.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    await expect(loading).toHaveCount(0, { timeout: 60_000 });
    const search = page.getByRole("searchbox", { name: "Filter tables" });
    await search.fill(prefix);
    await expect(page.getByRole("option", { name: last })).toHaveCount(0);
    const scroller = page.locator("nav[aria-label='Tables'] .overflow-auto");
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByRole("option", { name: last })).toBeVisible();
    await search.fill(`${prefix}29`);
    await page.getByRole("listbox", { name: "Table names" }).focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/t/${prefix}291/items$`));
  } finally {
    client.destroy();
    await deleteLocalTables(names);
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`table explorer axe and screenshots in ${scheme}`, async ({ page }) => {
    await shootExplorer(page, scheme);
  });
}

async function shootExplorer(page: Page, scheme: "light" | "dark") {
  await page.addInitScript((value) => {
    localStorage.setItem("mui-mode", value);
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page, "/t/orders/overview");
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Tables", exact: true })
    .screenshot({ path: `docs/screenshots/phase-3/sidebar-${scheme}.png` });
  await page.screenshot({ path: `docs/screenshots/phase-3/overview-${scheme}.png` });
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);
}
