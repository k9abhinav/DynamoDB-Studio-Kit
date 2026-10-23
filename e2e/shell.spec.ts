import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { isSerious } from "./axe.js";

test("keyboard can use the palette, sidebar, drawer, and shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/c/local/t/users/items");
  const search = page.getByRole("button", { name: /Search tables/ });
  await search.focus();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();

  await page.getByRole("searchbox", { name: "Filter tables" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "users" })).toBeFocused();

  const open = page.getByRole("button", { name: "Open details" });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Item details" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();

  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeHidden();
});

test("does not flash a light theme when dark is stored", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mui-mode", "dark");
    const seen: string[] = [];
    const remember = (value: string | null) => {
      if (value !== "light" && value !== "dark") {
        return;
      }
      seen.push(value);
      sessionStorage.setItem("ds-schemes", seen.join(","));
    };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- rebound with the element as this
    const original = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (this: Element, name: string, value: string) {
      if (name === "data-color-scheme" && this === document.documentElement) {
        remember(value);
      }
      original.call(this, name, value);
    };
    sessionStorage.setItem("ds-schemes", "");
  });
  await page.emulateMedia({ colorScheme: "light" });
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 8 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-color-scheme", "dark");
  const raw = await page.evaluate(() => sessionStorage.getItem("ds-schemes") ?? "");
  const schemes = raw.split(",").filter((scheme) => scheme.length > 0);
  expect(schemes.length).toBeGreaterThan(0);
  expect(schemes.every((scheme) => scheme === "dark")).toBe(true);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(32, 33, 36)");
});

for (const scheme of ["light", "dark"] as const) {
  test(`shell screenshots and axe in ${scheme}`, async ({ page }) => {
    await shootShell(page, scheme);
  });

  test(`gallery axe in ${scheme}`, async ({ page }) => {
    await page.addInitScript((value) => {
      localStorage.setItem("mui-mode", value);
    }, scheme);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/__design");
    await expect(page.getByRole("heading", { name: "Design gallery" })).toBeVisible();
    const radius = await page
      .getByTestId("layer-probe")
      .evaluate((element) => getComputedStyle(element).borderRadius);
    expect(radius).toBe("0px");
    await page.screenshot({
      path: `docs/screenshots/phase-1/gallery-${scheme}.png`,
      fullPage: true,
    });
    await expectNoSeriousAxe(page);
  });
}

async function shootShell(page: Page, scheme: "light" | "dark") {
  await page.addInitScript((value) => {
    localStorage.setItem("mui-mode", value);
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/c/local/t/users/items");
  await expect(page.getByRole("heading", { name: "users" })).toBeVisible();
  await page.screenshot({ path: `docs/screenshots/phase-1/shell-${scheme}.png` });
  await expectNoSeriousAxe(page);

  await page.getByRole("button", { name: "Open details" }).click();
  await expect(page.getByRole("dialog", { name: "Item details" })).toBeVisible();
  await page.screenshot({ path: `docs/screenshots/phase-1/shell-drawer-${scheme}.png` });

  await page.getByRole("button", { name: "Close item details" }).click();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("navigation", { name: "Tables" })).toHaveCSS("width", "72px");
  await page.screenshot({ path: `docs/screenshots/phase-1/shell-rail-${scheme}.png` });

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: `docs/screenshots/phase-1/shell-1024-${scheme}.png` });
}

async function expectNoSeriousAxe(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);
}
