import { expect, test, type Page } from "@playwright/test";
import {
  deleteLocalItems,
  deleteLocalTables,
  uniqueToken,
} from "../apps/server/src/local-cleanup.js";
import { connectLocal } from "./session.js";

for (const scheme of ["light", "dark"] as const) {
  test(`J1 shows tables after connect in ${scheme}`, async ({ page }) => {
    await useScheme(page, scheme);
    await page.goto("/");
    await page.getByRole("textbox", { name: "Endpoint" }).fill("http://localhost:8000");
    await page.getByRole("radio", { name: "Local" }).check();
    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByRole("heading", { name: "Pick a table to get started" })).toBeVisible();
    await expect(page.getByRole("option", { name: "users" })).toBeVisible();
    await capture(page, `j1-connect-${scheme}.png`);
  });

  test(`J2 opens an item and copies JSON in ${scheme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await useScheme(page, scheme);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await openWorkspace(page, "/t/users/items");
    await expect(page.getByRole("grid", { name: "Items" })).toBeVisible();
    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("combobox", { name: "Attribute" }).fill("id");
    await page.getByRole("textbox", { name: "Value" }).fill("user-0001");
    await page.getByRole("button", { name: "Apply filter" }).click();
    await page.getByRole("gridcell", { name: "user-0001" }).first().click();
    await expect(page.getByRole("dialog", { name: "Item details" })).toBeVisible();
    await page.getByRole("button", { name: "Copy" }).click();
    await page.getByRole("menuitem", { name: "DynamoDB JSON" }).click();
    await expect(page.getByText("Copied")).toBeVisible();
    await capture(page, `j2-item-${scheme}.png`);
  });

  test(`J3 validates, saves, and undoes an edit in ${scheme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await useScheme(page, scheme);
    await openWorkspace(page, "/t/edge-cases/items");
    const id = `p8${uniqueToken()}`;
    try {
      await putItem(page, id);
      await page.getByRole("button", { name: "Add filter" }).click();
      await page.getByRole("combobox", { name: "Attribute" }).fill("id");
      await page.getByRole("textbox", { name: "Value" }).fill(id);
      await page.getByRole("button", { name: "Apply filter" }).click();
      await page.getByRole("gridcell", { name: id }).click();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.locator(".monaco-editor")).toBeVisible();
      await writeEditor(page, "{");
      await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
      await expect(page.getByRole("listitem").first()).toBeVisible();
      await writeEditor(page, JSON.stringify({ id, email: "after@example.com" }, null, 2));
      await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(page.getByText("before@example.com").first()).toBeVisible();
      await capture(page, `j3-edit-${scheme}.png`);
    } finally {
      await deleteLocalItems("edge-cases", [id]);
    }
  });

  test(`J4 runs and saves a PartiQL query in ${scheme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await useScheme(page, scheme);
    await openWorkspace(page, "/t/users/partiql");
    await expect(page.locator(".monaco-editor")).toBeVisible();
    await setStatement(page, `SELECT * FROM "users" WHERE "id" = 'user-0001'`);
    await expect(page.locator(".monaco-editor .mtk1").first()).toBeVisible();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.getByRole("gridcell", { name: "user-0001" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Save query" }).click();
    await page.getByRole("textbox", { name: "Query name" }).fill(`phase8-${scheme}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog", { name: "Save query" })).toBeHidden();
    await capture(page, `j4-partiql-${scheme}.png`);
  });

  test(`J5 creates a table, imports, and exports in ${scheme}`, async ({ page }) => {
    test.setTimeout(120_000);
    const name = `p8${scheme}${uniqueToken()}`;
    await useScheme(page, scheme);
    const connectionId = await connectLocal(page);
    try {
      await page.goto(`/c/${connectionId}`);
      await page.getByRole("button", { name: "Create table" }).click();
      await page.getByRole("textbox", { name: "Table name" }).fill(name);
      await page.getByRole("textbox", { name: "Partition key" }).fill("id");
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("textbox", { name: "TTL attribute" }).fill("expiresAt");
      await page.getByRole("textbox", { name: "Index name" }).fill("kind-index");
      await page.getByRole("textbox", { name: "Index partition key" }).fill("kind");
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByText("Enabled on expiresAt")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText("kind-index", { exact: true }).first()).toBeVisible();
      await page.getByRole("tab", { name: "Items" }).click();
      await page.getByRole("button", { name: "Table actions" }).click();
      await page.getByRole("menuitem", { name: "Import" }).click();
      await page.getByLabel("Import file").setInputFiles("e2e/fixtures/notes.csv");
      await expect(page.getByText("007 stays a string")).toBeVisible();
      await capture(page, `j5-import-${scheme}.png`);
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Import items" }).getByText("Import finished."),
      ).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: "Close" }).click();
      await exportAs(page, "JSON", `${name}.json`);
      await exportAs(page, "CSV", `${name}.csv`);
    } finally {
      await deleteLocalTables([name]);
    }
  });
}

test("J1 names the endpoint when connect fails", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Endpoint" }).fill("http://127.0.0.1:9");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Couldn't reach http://127.0.0.1:9")).toBeVisible();
});

async function useScheme(page: Page, scheme: "light" | "dark"): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("mui-mode", value);
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function openWorkspace(page: Page, path: string): Promise<void> {
  const connectionId = await connectLocal(page);
  await page.goto(`/c/${connectionId}${path}`);
}

function isLinux(): boolean {
  const platform = (globalThis as { process?: { platform?: string } }).process?.platform;
  return platform === "linux";
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `docs/screenshots/phase-8/${name}` });
  if (isLinux()) {
    await expect(page).toHaveScreenshot(name, { maxDiffPixelRatio: 0.01 });
  }
}

async function putItem(page: Page, id: string): Promise<void> {
  const connectionId = connectionFrom(page.url());
  const response = await page.request.put(
    `/api/v1/connections/${connectionId}/tables/edge-cases/items`,
    {
      headers: { "x-ds-csrf": await csrf(page) },
      data: { item: { id: { S: id }, email: { S: "before@example.com" } }, ifNotExists: true },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function csrf(page: Page): Promise<string> {
  const session = await page.request.get("/api/v1/session");
  const body = (await session.json()) as { csrfToken?: string };
  if (body.csrfToken === undefined) {
    throw new Error("missing csrf");
  }
  return body.csrfToken;
}

function connectionFrom(url: string): string {
  const match = /\/c\/([^/]+)/.exec(url);
  if (match?.[1] === undefined) {
    throw new Error("missing connection");
  }
  return match[1];
}

async function writeEditor(page: Page, value: string): Promise<void> {
  await page.locator(".monaco-editor").evaluate((node, next) => {
    const host = node as HTMLElement & {
      studioEditor?: {
        executeEdits: (source: string, edits: { range: unknown; text: string }[]) => void;
        getModel: () => { getFullModelRange: () => unknown } | null;
      };
    };
    const editor = host.studioEditor;
    const model = editor?.getModel();
    if (editor === undefined || model === null || model === undefined) {
      throw new Error("The code editor is not ready");
    }
    editor.executeEdits("e2e", [{ range: model.getFullModelRange(), text: next }]);
  }, value);
}

async function setStatement(page: Page, statement: string): Promise<void> {
  await page.locator(".monaco-editor").evaluate((node, value) => {
    const host = node as HTMLElement & { studioEditor?: { setValue: (next: string) => void } };
    if (host.studioEditor === undefined) {
      throw new Error("PartiQL editor is not ready");
    }
    host.studioEditor.setValue(value);
  }, statement);
}

async function exportAs(page: Page, format: "JSON" | "CSV", filename: string): Promise<void> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Table actions" }).click();
  await page.getByRole("menuitem", { name: "Export" }).click();
  await page.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: format, exact: true }).click();
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(filename);
  await page.getByRole("button", { name: "Dismiss" }).click();
}
