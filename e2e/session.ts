import { expect, type Page } from "@playwright/test";

export async function connectLocal(
  page: Page,
  endpoint = "http://127.0.0.1:8000",
  readOnly = false,
): Promise<string> {
  const session = await page.request.get("/api/v1/session");
  expect(session.ok()).toBeTruthy();
  const csrfToken = readString(await session.json(), "csrfToken");
  const created = await page.request.post("/api/v1/connections", {
    headers: { "x-ds-csrf": csrfToken },
    data: {
      endpoint,
      region: "us-east-1",
      auth: { type: "local" },
      env: "local",
      readOnly,
      remember: false,
    },
  });
  const raw = await created.text();
  expect(created.ok(), raw).toBeTruthy();
  return readString(JSON.parse(raw) as unknown, "connectionId");
}

function readString(value: unknown, key: string): string {
  if (typeof value !== "object" || value === null || !(key in value)) {
    throw new Error(`Missing ${key}`);
  }
  const field = value[key as keyof typeof value];
  if (typeof field !== "string") {
    throw new Error(`Missing ${key}`);
  }
  return field;
}

export async function openWorkspace(page: Page, pathAfterConnection: string): Promise<void> {
  const connectionId = await connectLocal(page);
  await page.goto(`/c/${connectionId}${pathAfterConnection}`);
}
