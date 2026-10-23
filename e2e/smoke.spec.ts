import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { isSerious } from "./axe.js";

test("connect screen shows DynamoDB Studio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DynamoDB Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);
});
