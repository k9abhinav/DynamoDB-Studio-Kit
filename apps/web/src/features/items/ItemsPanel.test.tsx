import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { resetApiSession } from "../../lib/api.js";
import { useUiStore } from "../../stores/ui.js";
import { ItemDrawer } from "../workspace/ItemDrawer.js";
import { ItemsPanel } from "./ItemsPanel.js";

const digits = "12345678901234567890123456789012345678";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetApiSession();
  useUiStore.setState({ drawerOpen: false, itemPreview: null, openTables: [], draftKind: "view" });
});

describe("ItemsPanel", () => {
  it("shows an empty table, then a plain JSON preview", async () => {
    const user = userEvent.setup();
    stubScan({
      items: [{ id: { S: "user-0001" }, email: { S: "a@example.com" } }],
      count: 1,
      scannedCount: 4,
      hasMore: false,
      consumedCapacity: { rcu: 1.5 },
    });
    render(
      <AppProviders>
        <ItemsPanel connectionId="local" table="users" />
        <ItemDrawer connectionId="local" table="users" />
      </AppProviders>,
    );
    expect(await screen.findByText("Showing 1 · Scanned 4 · 1.5 RCU")).toBeInTheDocument();
    expect(screen.getByText("End of results")).toBeInTheDocument();
    expect(screen.getByText("1 items loaded")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
    await user.click(screen.getByText("a@example.com"));
    expect(screen.getByRole("dialog", { name: "Item details" })).toHaveTextContent("a@example.com");
    expect(screen.getByRole("dialog", { name: "Item details" })).not.toHaveTextContent('"S":');
    await user.click(screen.getByRole("button", { name: "Query" }));
    expect(screen.getByText("Query builder arrives in the next step")).toBeInTheDocument();
  });

  it("keeps the selected count after another page loads", async () => {
    const user = userEvent.setup();
    stubScan(
      {
        items: [{ id: { S: "a" } }],
        count: 1,
        scannedCount: 1,
        hasMore: true,
        nextCursor: "page-2",
      },
      [],
      "http://127.0.0.1:8000",
      { items: [{ id: { S: "b" } }], count: 1, scannedCount: 1, hasMore: false },
    );
    render(
      <AppProviders>
        <ItemsPanel connectionId="local" table="users" />
      </AppProviders>,
    );
    await user.click(await screen.findByRole("checkbox", { name: "Select row 1" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(await screen.findByText("Showing 2 · Scanned 2 · 0 RCU")).toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select row 2" })).not.toBeChecked();
  });

  it("offers create, keep searching, and a retry", async () => {
    const user = userEvent.setup();
    stubScan({ items: [], count: 0, scannedCount: 0, hasMore: false });
    const empty = render(
      <AppProviders>
        <ItemsPanel connectionId="local" table="users" />
      </AppProviders>,
    );
    expect(
      await screen.findByRole("heading", { name: "This table is empty." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create item" })).toBeDisabled();
    empty.unmount();

    stubScan({ items: [], count: 0, scannedCount: 20, hasMore: true, nextCursor: "more" });
    const searching = render(
      <AppProviders>
        <ItemsPanel connectionId="local" table="orders" />
      </AppProviders>,
    );
    expect(await screen.findByRole("button", { name: "Keep searching" })).toBeInTheDocument();
    searching.unmount();

    stubScan(null);
    render(
      <AppProviders>
        <ItemsPanel connectionId="local" table="edge-cases" />
      </AppProviders>,
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
  });

  it("caps 500 columns and sends a 38-digit number as a string", async () => {
    const user = userEvent.setup();
    const wide: Record<string, { S: string } | { N: string }> = { id: { S: "wide" } };
    for (let index = 0; index < 500; index += 1) {
      wide[`attr-${String(index).padStart(3, "0")}`] = { S: "x" };
    }
    wide.digits = { N: "1" };
    const bodies: unknown[] = [];
    stubScan(
      {
        items: [wide],
        count: 1,
        scannedCount: 1,
        hasMore: false,
      },
      bodies,
      "https://dynamodb.us-east-1.amazonaws.com",
    );
    render(
      <AppProviders>
        <div className="flex h-[640px] flex-col">
          <ItemsPanel connectionId="local" table="edge-cases" />
        </div>
      </AppProviders>,
    );
    expect(await screen.findByRole("button", { name: "Show more columns" })).toBeInTheDocument();
    expect(screen.getByText(/consumes read capacity/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss scan cost hint" }));
    expect(screen.queryByText(/consumes read capacity/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more columns" }));
    expect(screen.queryByRole("button", { name: "Show more columns" })).not.toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Items" })).toHaveAttribute("aria-colcount", "503");

    await user.click(screen.getByRole("button", { name: "Add filter" }));
    await user.type(screen.getByRole("combobox", { name: "Attribute" }), "digits");
    await user.type(screen.getByRole("textbox", { name: "Value" }), digits);
    await user.click(screen.getByRole("button", { name: "Apply filter" }));
    const last = bodies.at(-1) as { filters?: { value?: { N?: string } }[] };
    expect(last.filters?.[0]?.value?.N).toBe(digits);
    expect(await screen.findByText("No items match these filters.")).toBeInTheDocument();
  });

  it("keeps hidden columns for one table", async () => {
    const user = userEvent.setup();
    stubScan({
      items: [{ id: { S: "user-0001" }, email: { S: "a@example.com" } }],
      count: 1,
      scannedCount: 1,
      hasMore: false,
    });
    const first = render(
      <AppProviders>
        <ItemsPanel connectionId="local" table="users" />
      </AppProviders>,
    );
    expect(await screen.findByRole("button", { name: "email" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("checkbox", { name: "Show email" }));
    expect(screen.queryByRole("button", { name: "email" })).not.toBeInTheDocument();
    const stored = Object.keys(localStorage).find((key) => key.startsWith("ds-columns:"));
    expect(stored).toBeDefined();
    expect(stored).not.toContain("8000");
    first.unmount();
    render(
      <AppProviders>
        <ItemsPanel connectionId="local" table="users" />
      </AppProviders>,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "id" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "email" })).not.toBeInTheDocument();
    });
  });
});

function stubScan(
  page: {
    items: unknown[];
    count: number;
    scannedCount: number;
    hasMore: boolean;
    nextCursor?: string;
    consumedCapacity?: { rcu: number };
  } | null,
  bodies: unknown[] = [],
  endpoint = "http://127.0.0.1:8000",
  next?: {
    items: unknown[];
    count: number;
    scannedCount: number;
    hasMore: boolean;
  },
): void {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/v1/session")) {
      return Promise.resolve(json({ csrfToken: "csrf-test", version: "0.0.0" }));
    }
    if (method === "GET" && url.includes("/tables/")) {
      return Promise.resolve(
        json(errorBody("NOT_FOUND", "That table doesn't exist (anymore)."), 404),
      );
    }
    if (method === "GET" && url.includes("/api/v1/connections/")) {
      return Promise.resolve(
        json({
          summary: {
            name: "Local dev",
            endpoint,
            region: "us-east-1",
            env: "local",
            readOnly: false,
            authType: "local",
          },
          latencyMs: 12,
        }),
      );
    }
    if (method === "POST" && url.includes("/scan")) {
      if (typeof init?.body === "string") {
        bodies.push(JSON.parse(init.body) as unknown);
      }
      if (page === null) {
        return Promise.resolve(
          json(errorBody("ENDPOINT_UNREACHABLE", "The endpoint did not answer."), 502),
        );
      }
      const requested =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as { filters?: unknown[]; cursor?: string })
          : {};
      if (requested.cursor !== undefined && next !== undefined) {
        return Promise.resolve(json(next));
      }
      if (requested.filters !== undefined && requested.filters.length > 0) {
        return Promise.resolve(json({ items: [], count: 0, scannedCount: 10, hasMore: false }));
      }
      return Promise.resolve(json(page));
    }
    return Promise.resolve(json(errorBody("NOT_FOUND", "Missing."), 404));
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorBody(code: string, message: string) {
  return {
    error: { code, message, retryable: false, requestId: "req-test" },
  };
}
