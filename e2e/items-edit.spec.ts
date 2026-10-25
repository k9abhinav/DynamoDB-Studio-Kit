import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { isSerious } from "./axe.js";
import { openWorkspace } from "./session.js";

const stamp = String(Date.now());

test("edits an item locally and undoes it", async ({ page }) => {
  test.setTimeout(120_000);
  const foreign: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") {
      foreign.push(request.url());
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page, "/t/edge-cases/items");
  const id = `p5-edit-${stamp}`;
  await putItem(page, id, { email: { S: "before@example.com" } });
  await showItem(page, id);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  expect(foreign).toEqual([]);
  await replaceEditor(page, itemJson(id, { email: "after@example.com" }));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("after@example.com").first()).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("before@example.com").first()).toBeVisible();
  const stored = await getItem(page, id);
  expect(stored.email).toEqual({ S: "before@example.com" });
  await deleteItem(page, id);
});

test("saves through the textarea fallback without changing types", async ({ page }) => {
  test.setTimeout(120_000);
  await openWorkspace(page, "/t/edge-cases/items");
  const id = `p5-text-${stamp}`;
  await putItem(page, id, {
    email: { S: "typed@example.com" },
    n: { N: "1E+2" },
    tags: { SS: ["a", "b"] },
  });
  await showItem(page, id);
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.includes("monaco") || url.includes("JsonEditor")) {
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByText("The code editor could not be loaded. You can still edit the JSON here."),
  ).toBeVisible();
  const field = page.getByRole("textbox", { name: "Item JSON" });
  await field.fill(
    (await field.inputValue()).replace("typed@example.com", "typed-next@example.com"),
  );
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  const stored = await getItem(page, id);
  expect(stored.email).toEqual({ S: "typed-next@example.com" });
  expect(stored.tags).toEqual({ SS: ["a", "b"] });
  expect(stored.n).toEqual({ N: "100" });
  await deleteItem(page, id);
});

test("shows a conflict when another session changes the item", async ({ page }) => {
  test.setTimeout(120_000);
  await openWorkspace(page, "/t/edge-cases/items");
  const id = `p5-conflict-${stamp}`;
  await putItem(page, id, { email: { S: "one@example.com" } });
  await showItem(page, id);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await replaceEditor(page, itemJson(id, { email: "mine@example.com" }));
  await updateItem(page, id, { email: { S: "theirs@example.com" } });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "This item changed since you opened it" }),
  ).toBeVisible();
  await expect(page.getByText("The conflict check is best-effort.")).toBeVisible();
  await page.getByRole("button", { name: "Reload latest" }).click();
  await expect(page.getByText("theirs@example.com").first()).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await replaceEditor(page, itemJson(id, { email: "mine-again@example.com" }));
  await updateItem(page, id, { email: { S: "third@example.com" } });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "This item changed since you opened it" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overwrite" }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  const stored = await getItem(page, id);
  expect(stored.email).toEqual({ S: "mine-again@example.com" });
  await deleteItem(page, id);
});

test("explains a create collision and confirms a production delete", async ({ page }) => {
  test.setTimeout(120_000);
  await openWorkspace(page, "/t/edge-cases/items");
  const id = `p5-new-${stamp}`;
  await putItem(page, id, { email: { S: "exists@example.com" } });
  await expect(page.getByRole("button", { name: "Create item" })).toBeEnabled();
  await page.getByRole("button", { name: "Create item" }).click();
  await replaceEditor(page, itemJson(id, { email: "again@example.com" }));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("An item with this key already exists.")).toBeVisible();
  await deleteItem(page, id);

  await page.goto("/");
  const connectionId = await connectProduction(page);
  await page.goto(`/c/${connectionId}/t/edge-cases/items`);
  const prodId = `p5-prod-${stamp}`;
  await putItem(page, prodId, { email: { S: "prod@example.com" } });
  await showItem(page, prodId);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this item?" });
  await dialog.getByRole("textbox", { name: "Type edge-cases to confirm" }).fill("edge-cases");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted")).toBeVisible();
});

test("deletes 100 created items from the grid", async ({ page }) => {
  test.setTimeout(180_000);
  await openWorkspace(page, "/t/edge-cases/items");
  const prefix = `p5-bulk-${stamp}-`;
  for (let index = 0; index < 100; index += 1) {
    await putItem(page, `${prefix}${String(index).padStart(3, "0")}`, {
      email: { S: "bulk@example.com" },
    });
  }
  await page.getByRole("combobox", { name: "Page size" }).click();
  await page.getByRole("option", { name: "500", exact: true }).click();
  await page.getByRole("button", { name: "Add filter" }).click();
  await page.getByLabel("Attribute").fill("id");
  await page.getByRole("combobox", { name: "Operator" }).click();
  await page.getByRole("option", { name: "begins_with" }).click();
  await page.getByRole("textbox", { name: "Value" }).fill(prefix);
  await page.getByRole("button", { name: "Apply filter" }).click();
  await expect(page.getByText(/Showing 100 ·/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("checkbox", { name: "Select all loaded items" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete 100 items?" });
  await dialog.getByRole("textbox", { name: "Type DELETE to confirm" }).fill("DELETE");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted 100, 0 failed")).toBeVisible({ timeout: 60_000 });
});

test("saves a 390 KB item and blocks one over 400 KB", async ({ page }) => {
  test.setTimeout(120_000);
  await openWorkspace(page, "/t/edge-cases/items");
  await showItem(page, "large");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await editModel(page, (current) => current.replace("aaaaaaaa", "aaaaaaab"));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  expect((await blobText(page, "large")).includes("aaaaaaab")).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await blobText(page, "large")).includes("aaaaaaab")).toBe(false);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const oversized = (await readModel(page)).replace("a".repeat(100), "a".repeat(20_000));
  await writeModel(page, oversized);
  await expect(page.getByText("This item is over 400 KB. DynamoDB allows 400 KB.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
});

test("opens a large item and checks the drawer for serious accessibility issues", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await openWorkspace(page, "/t/edge-cases/items");
    await showItem(page, "large");
    await expect(page.getByRole("dialog", { name: "Item details" })).toBeVisible();
    await page.screenshot({ path: `docs/screenshots/phase-5/item-drawer-${scheme}.png` });
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter((violation) => isSerious(violation.impact))).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Item details" })).toBeHidden();
    await expect(page.getByRole("gridcell", { name: "large" })).toBeFocused();
  }
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await showItem(page, "sets");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
});

async function showItem(page: Page, id: string): Promise<void> {
  await page.getByRole("button", { name: "Add filter" }).click();
  await page.getByLabel("Attribute").fill("id");
  await page.getByLabel("Value").fill(id);
  await page.getByRole("button", { name: "Apply filter" }).click();
  await page.getByRole("gridcell", { name: id }).click();
  await expect(page.getByRole("dialog", { name: "Item details" })).toBeVisible();
}

async function editModel(page: Page, change: (current: string) => string): Promise<void> {
  const current = await readModel(page);
  await writeModel(page, change(current));
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled({
    timeout: 15_000,
  });
}

async function readModel(page: Page): Promise<string> {
  await expect(page.locator(".monaco-editor")).toBeVisible();
  return page.locator(".monaco-editor").evaluate((node) => {
    const host = node as HTMLElement & {
      studioEditor?: { getModel: () => { getValue: () => string } | null };
    };
    return host.studioEditor?.getModel()?.getValue() ?? "";
  });
}

async function writeModel(page: Page, next: string): Promise<void> {
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page.locator(".monaco-editor").evaluate((node, value) => {
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
    editor.executeEdits("e2e", [{ range: model.getFullModelRange(), text: value }]);
  }, next);
}

async function replaceEditor(page: Page, value: string): Promise<void> {
  await editModel(page, () => value);
}

function itemJson(id: string, fields: Record<string, string>): string {
  return JSON.stringify({ id, ...fields }, null, 2);
}

async function putItem(page: Page, id: string, extra: Record<string, unknown>): Promise<void> {
  const response = await page.request.put(itemUrl(connectionFrom(page.url()), ""), {
    headers: { "x-ds-csrf": await csrf(page) },
    data: { item: { id: { S: id }, ...extra }, ifNotExists: true },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function updateItem(page: Page, id: string, extra: Record<string, unknown>): Promise<void> {
  const response = await page.request.post(itemUrl(connectionFrom(page.url()), "/update"), {
    headers: { "x-ds-csrf": await csrf(page) },
    data: { key: { id: { S: id } }, item: { id: { S: id }, ...extra } },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

function requiredString(value: { S?: string } | undefined): string {
  if (value === undefined || value.S === undefined) {
    throw new Error("missing value");
  }
  return value.S;
}

async function blobText(page: Page, id: string): Promise<string> {
  const item = await getItem(page, id);
  return requiredString(item.blob);
}

async function getItem(
  page: Page,
  id: string,
): Promise<Record<string, { S?: string; N?: string; SS?: string[] }>> {
  const response = await page.request.post(itemUrl(connectionFrom(page.url()), "/get"), {
    headers: { "x-ds-csrf": await csrf(page) },
    data: { key: { id: { S: id } } },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as {
    item: Record<string, { S?: string; N?: string; SS?: string[] }>;
  };
  return body.item;
}

async function deleteItem(page: Page, id: string): Promise<void> {
  await page.request.post(itemUrl(connectionFrom(page.url()), "/delete"), {
    headers: { "x-ds-csrf": await csrf(page) },
    data: { key: { id: { S: id } } },
  });
}

async function connectProduction(page: Page): Promise<string> {
  const created = await page.request.post("/api/v1/connections", {
    headers: { "x-ds-csrf": await csrf(page) },
    data: {
      endpoint: "http://127.0.0.1:8000",
      region: "us-east-1",
      auth: { type: "local" },
      env: "production",
      readOnly: false,
      remember: false,
    },
  });
  const body = (await created.json()) as { connectionId?: string };
  if (!created.ok() || body.connectionId === undefined) {
    throw new Error("production connect failed");
  }
  return body.connectionId;
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

function itemUrl(connectionId: string, action: string): string {
  return `/api/v1/connections/${connectionId}/tables/edge-cases/items${action}`;
}
