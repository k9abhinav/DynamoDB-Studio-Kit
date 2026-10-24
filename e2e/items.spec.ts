import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { isSerious } from "./axe.js";
import { openWorkspace } from "./session.js";

const digits = "12345678901234567890123456789012345678";

test("browses orders, filters status, and opens an item from the keyboard", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page, "/t/orders/items");
  await expect(page.getByText(/Showing \d+ · Scanned/)).toBeVisible();
  await page.getByRole("button", { name: "Add filter" }).click();
  await page.getByRole("combobox", { name: "Attribute" }).fill("status");
  await page.getByRole("textbox", { name: "Value" }).fill("SHIPPED");
  await page.getByRole("button", { name: "Apply filter" }).click();
  await expect(
    page.getByText("Filters run after reading items, so Scan still reads the whole page."),
  ).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "PENDING" })).toHaveCount(0);
  await expect(page.getByRole("gridcell", { name: "SHIPPED" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("checkbox", { name: "Show orderId" }).click();
  await expect(page.getByRole("columnheader", { name: "orderId" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const cell = page
    .getByRole("grid", { name: "Items" })
    .getByRole("row")
    .nth(1)
    .getByRole("gridcell")
    .nth(1);
  await cell.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Item details" })).toContainText('"S": "SHIPPED"');
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Item details" })).toBeHidden();

  await page.getByRole("searchbox", { name: "Filter tables" }).fill("edge");
  await page.getByRole("option", { name: "edge-cases" }).click();
  await expect(page.getByRole("heading", { name: "edge-cases" })).toBeVisible();
  const edgeGrid = page.getByRole("grid", { name: "Items" });
  await expect(edgeGrid).toBeVisible();
  await expect
    .poll(async () => {
      if (await page.getByText(digits).isVisible()) {
        return true;
      }
      await edgeGrid.evaluate((node) => {
        node.scrollTop += node.clientHeight;
      });
      return false;
    })
    .toBe(true);
  await expect(page.getByRole("gridcell", { name: "Empty string", exact: true })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "Null", exact: true })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "Missing", exact: true }).first()).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`items screenshots and axe in ${scheme}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript((value) => {
      localStorage.setItem("mui-mode", value);
    }, scheme);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorkspace(page, "/t/orders/items");
    await expect(page.getByRole("grid", { name: "Items" })).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/phase-4/items-${scheme}.png` });
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByRole("button", { name: "Add filter" })).toBeVisible();
    await expect(page.getByRole("grid", { name: "Items" })).toBeVisible();
  });
}

test("scrolls 10000 loaded order rows at 4x cpu", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page, "/t/orders/items");
  await page.getByRole("combobox", { name: "Page size" }).click();
  await page.getByRole("option", { name: "500", exact: true }).click();
  await expect
    .poll(async () => {
      const text = await page.locator("p", { hasText: /^Showing / }).innerText();
      return Number(/^Showing (\d+)/.exec(text)?.[1] ?? "0");
    })
    .toBeGreaterThanOrEqual(500);
  for (let step = 0; step < 25; step += 1) {
    const summary = page.locator("p", { hasText: /^Showing / });
    const before = await summary.innerText();
    if (before.startsWith("Showing 10000")) {
      break;
    }
    await page.getByRole("button", { name: "Load more" }).click({ timeout: 15_000 });
    await expect(summary).not.toHaveText(before, { timeout: 30_000 });
  }
  await expect(page.getByText(/Showing 10000 ·/)).toBeVisible();
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const fps = await page.evaluate(async () => {
    const grid = document.querySelector("[aria-label='Items']");
    if (!(grid instanceof HTMLElement)) {
      throw new Error("missing items grid");
    }
    let frames = 0;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        frames += 1;
        grid.scrollTop += 96;
        if (now - started >= 2000) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
    return frames / ((performance.now() - started) / 1000);
  });
  test.info().annotations.push({
    type: "fps",
    description: `${fps.toFixed(1)} fps; browser Chromium; throttle 4x; method requestAnimationFrame scrolling the items grid by 96px on the Vite dev server`,
  });
  expect(fps).toBeGreaterThanOrEqual(55);
});
