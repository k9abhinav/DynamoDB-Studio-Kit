import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("placeholder shows DynamoDB Studio and the health status", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DynamoDB Studio" })).toBeVisible();
  await expect(page.getByText("Server 0.0.0 is ok.")).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/phase-0/placeholder-light.png",
    fullPage: true,
  });
  const light = await new AxeBuilder({ page }).analyze();
  expect(light.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);
});

test("placeholder has no critical axe violations in a dark color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DynamoDB Studio" })).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/phase-0/placeholder-dark.png",
    fullPage: true,
  });
  const dark = await new AxeBuilder({ page }).analyze();
  expect(dark.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);
});

function isSerious(impact: string | null | undefined): boolean {
  return impact === "serious" || impact === "critical";
}
