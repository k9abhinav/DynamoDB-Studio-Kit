import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { deleteLocalItems, uniqueToken } from "../apps/server/src/local-cleanup.js";
import { isSerious } from "./axe.js";
import { connectLocal } from "./session.js";

test("queries orders and runs PartiQL from the keyboard", async ({ page }) => {
  test.setTimeout(120_000);
  const id = `p6e2e${uniqueToken()}`;
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    const connectionId = await connectLocal(page);
    await page.goto(`/c/${connectionId}/t/orders/items`);
    await expect(page.getByText(/Showing \d+ · Scanned/)).toBeVisible();
    await page.getByRole("button", { name: "Query" }).click();
    await page.getByRole("textbox", { name: "userId" }).fill("user-0001");
    await page.keyboard.press("Control+Enter");
    await expect(page.getByRole("gridcell", { name: "user-0001" }).first()).toBeVisible();

    await page.getByRole("checkbox", { name: "Sort key createdAt" }).check();
    await page.getByRole("combobox", { name: "Operator" }).click();
    await page.getByRole("option", { name: "between" }).click();
    await page.getByRole("textbox", { name: "Value", exact: true }).fill("2024-01-01");
    await page.getByRole("textbox", { name: "And value" }).fill("2025-01-01");
    await page.getByRole("combobox", { name: "Sort order" }).click();
    await page.getByRole("option", { name: "Descending" }).click();
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByRole("gridcell", { name: "user-0001" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Show request" }).click();
    await expect(page.getByText(/BETWEEN/)).toBeVisible();
    await page.getByRole("tab", { name: "AWS CLI" }).click();
    await expect(page.getByText(/aws dynamodb query/)).toBeVisible();
    await expect(page.getByText(/secret|access-key/i)).toHaveCount(0);

    await page.getByRole("combobox", { name: "Target" }).click();
    await page.getByRole("option", { name: "status-createdAt-index" }).click();
    await expect(page.getByRole("checkbox", { name: "Consistent read" })).toBeDisabled();
    await page.getByRole("textbox", { name: "status" }).fill("SHIPPED");
    await page.getByRole("checkbox", { name: "Sort key createdAt" }).check();
    await page.getByRole("combobox", { name: "Operator" }).click();
    await page.getByRole("option", { name: "begins_with" }).click();
    await page.getByRole("textbox", { name: "Value", exact: true }).fill("2024");
    await page.getByRole("button", { name: "Show request" }).click();
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByText(/Showing 50 · Scanned 50/)).toBeVisible();
    await expect(page.getByRole("gridcell", { name: /user-/ }).first()).toBeVisible();

    await page.getByRole("tab", { name: "PartiQL" }).click();
    await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
    await page.getByRole("button", { name: "Templates" }).click();
    await page.getByRole("menuitem", { name: "Select by partition key" }).click();
    await page.getByRole("button", { name: "Add parameter" }).click();
    await page.getByRole("textbox", { name: "Parameter 1 (S)" }).fill("user-0001");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByRole("gridcell", { name: "user-0001" }).first()).toBeVisible();
    await page.getByRole("button", { name: "History" }).click();
    await expect(page.getByRole("button", { name: /SELECT \* FROM "orders"/ })).toBeVisible();
    await page.keyboard.press("Escape");

    await setStatement(
      page,
      `INSERT INTO "users" VALUE {'id': '${id}', 'email': '${id}@example.test', 'name': 'p6'}`,
    );
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByRole("dialog", { name: "INSERT statement" })).toBeVisible();
    await page.getByRole("button", { name: "Run statement" }).click();
    await expect(page.getByText("The statement ran.")).toBeVisible();

    await setStatement(page, `DELETE FROM "users" WHERE "id" = '${id}'`);
    await page.getByRole("button", { name: "Run" }).click();
    await page.getByRole("button", { name: "Run statement" }).click();
    await expect(page.getByText("The statement ran.")).toBeVisible();
  } finally {
    await deleteLocalItems("users", [id]);
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`query and partiql axe in ${scheme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript((value) => {
      localStorage.setItem("mui-mode", value);
    }, scheme);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1440, height: 900 });
    const connectionId = await connectLocal(page);
    await page.goto(`/c/${connectionId}/t/orders/items`);
    await page.getByRole("button", { name: "Query" }).click();
    await page.getByRole("textbox", { name: "userId" }).fill("user-0001");
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByRole("grid", { name: "Items" })).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/phase-6/query-${scheme}.png` });
    const queryAxe = await new AxeBuilder({ page }).analyze();
    expect(queryAxe.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByRole("button", { name: "Run query" })).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.zoom = "1";
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole("tab", { name: "PartiQL" }).click();
    await expect(page.locator(".monaco-editor")).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/phase-6/partiql-${scheme}.png` });
    const partiqlAxe = await new AxeBuilder({ page }).analyze();
    expect(partiqlAxe.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);
  });
}

async function setStatement(page: Page, statement: string): Promise<void> {
  await page.locator(".monaco-editor").waitFor();
  await page.evaluate((value) => {
    const node = document.querySelector(".monaco-editor");
    if (node === null || !("studioEditor" in node)) {
      throw new Error("PartiQL editor is not ready");
    }
    const editor = node.studioEditor as { setValue: (next: string) => void };
    editor.setValue(value);
  }, statement);
}
