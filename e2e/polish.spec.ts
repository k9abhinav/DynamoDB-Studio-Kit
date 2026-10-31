import { expect, test, type Page } from "@playwright/test";
import { ensureDir } from "../apps/server/src/test-files.js";
import { connectLocal } from "./session.js";

for (const scheme of ["light", "dark"] as const) {
  test(`screenshots of each main screen in ${scheme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await ensureDir("docs/screenshots/phase-8");
    await page.addInitScript((value) => {
      localStorage.setItem("mui-mode", value);
    }, scheme);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "DynamoDB Studio" })).toBeVisible();
    await expect(page.getByText("docker run -p 8000:8000 amazon/dynamodb-local")).toBeVisible();
    await shot(page, `connect-${scheme}`);

    await page.getByRole("textbox", { name: "Endpoint" }).fill("http://127.0.0.1:9");
    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByText(/Couldn't reach/)).toBeVisible();
    await shot(page, `connect-error-${scheme}`);

    const connectionId = await connectLocal(page);
    await page.goto(`/c/${connectionId}`);
    await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
    await shot(page, `workspace-${scheme}`);

    await page.goto(`/c/${connectionId}/t/orders/items`);
    await expect(page.getByRole("grid", { name: "Items" })).toBeVisible();
    await shot(page, `items-${scheme}`);

    await page.getByRole("button", { name: "Table actions" }).click();
    await page.getByRole("menuitem", { name: "Export" }).click();
    await expect(page.getByRole("dialog", { name: "Export items" })).toBeVisible();
    await shot(page, `export-${scheme}`);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Table actions" }).click();
    await page.getByRole("menuitem", { name: "Import" }).click();
    await expect(page.getByRole("dialog", { name: "Import items" })).toBeVisible();
    await shot(page, `import-${scheme}`);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Query" }).click();
    await expect(page.getByRole("button", { name: "Run query" })).toBeVisible();
    await shot(page, `query-${scheme}`);

    await page.goto(`/c/${connectionId}/t/orders/overview`);
    await expect(page.getByText(/About .* items/)).toBeVisible();
    await shot(page, `overview-${scheme}`);

    await page.goto(`/c/${connectionId}/t/orders/indexes`);
    await expect(page.getByRole("heading", { name: "Global secondary indexes" })).toBeVisible();
    await shot(page, `indexes-${scheme}`);

    await page.goto(`/c/${connectionId}/t/users/partiql`);
    await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
    await shot(page, `partiql-${scheme}`);

    await page.getByRole("button", { name: /Search tables/ }).click();
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
    await shot(page, `palette-${scheme}`);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Shortcuts" }).click();
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await shot(page, `shortcuts-${scheme}`);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "About" }).click();
    await expect(page.getByRole("dialog", { name: "About" })).toBeVisible();
    await shot(page, `about-${scheme}`);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Create table" }).click();
    await expect(page.getByRole("dialog", { name: "Create table" })).toBeVisible();
    await shot(page, `create-table-${scheme}`);
    await page.keyboard.press("Escape");

    await page.goto(`/c/${connectionId}/t/orders/items`);
    await expect(page.getByRole("grid", { name: "Items" })).toBeVisible();
    const row = page.getByRole("grid", { name: "Items" }).getByRole("row").nth(1);
    await row.getByRole("gridcell").nth(1).click();
    await expect(page.getByRole("dialog", { name: "Item details" })).toBeVisible();
    await shot(page, `item-drawer-${scheme}`);

    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "That page doesn't exist" })).toBeVisible();
    await shot(page, `not-found-${scheme}`);
  });
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `docs/screenshots/phase-8/${name}.png` });
}
