import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { isSerious } from "./axe.js";
import { startProxy } from "./proxy.js";

test("reaches the workspace from a pasted URL with Enter", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Endpoint" })).toBeFocused();
  await page.keyboard.type("localhost:8000");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
  await expect(page.getByText(/\d+ms/)).toBeVisible();
});

test("retries a wrong URL without reloading", async ({ page }) => {
  await page.goto("/");
  const endpoint = page.getByRole("textbox", { name: "Endpoint" });
  await endpoint.fill("http://127.0.0.1:9");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(
    page.getByText("Couldn't reach http://127.0.0.1:9. Is DynamoDB running and the URL correct?"),
  ).toBeVisible();
  await endpoint.fill("localhost:8000");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
});

test("can complete the connect form from the keyboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Endpoint" })).toBeFocused();
  await page.keyboard.type("localhost:8000");
  await expect(page.getByRole("radio", { name: "Local" })).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "Region" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "Local" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Connect" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`connect screen axe and screenshot in ${scheme}`, async ({ page }) => {
    await shootConnect(page, scheme);
  });
}

test("shows connection lost when the endpoint proxy closes", async ({ page }) => {
  test.setTimeout(60_000);
  const proxy = await startProxy(8000);
  try {
    await page.goto("/");
    await page
      .getByRole("textbox", { name: "Endpoint" })
      .fill(`http://127.0.0.1:${String(proxy.port)}`);
    await page.keyboard.press("Enter");
    await expect(page.getByText(/\d+ms/)).toBeVisible();
    await proxy.close();
    await expect(page.getByText("Connection lost. Retry / Disconnect")).toBeVisible({
      timeout: 35_000,
    });
  } finally {
    await proxy.close();
  }
});

async function shootConnect(page: Page, scheme: "light" | "dark") {
  await page.addInitScript((value) => {
    localStorage.setItem("mui-mode", value);
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DynamoDB Studio" })).toBeVisible();
  await page.screenshot({ path: `docs/screenshots/phase-2/connect-${scheme}.png` });
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);

  await page.getByRole("textbox", { name: "Endpoint" }).fill("localhost:8000");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
  await page.screenshot({ path: `docs/screenshots/phase-2/workspace-${scheme}.png` });
}
