import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rememberTable } from "../lib/palette-recent.js";
import { useOverlayStore } from "../stores/overlay.js";
import { useUiStore } from "../stores/ui.js";
import { renderAt } from "../test/render.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const summary = {
  name: "Local dev",
  endpoint: "http://127.0.0.1:8000",
  region: "us-east-1",
  env: "local",
  readOnly: false,
  authType: "local",
};

describe("CommandPalette", () => {
  it("jumps to a recent table and hides tables in actions-only mode", async () => {
    const user = userEvent.setup();
    rememberTable(localStorage, "c1", "users");
    install();
    await renderAt("/c/c1", { api: "custom" });
    useOverlayStore.getState().openOverlay("palette");
    const search = await screen.findByRole("textbox", { name: "Search" });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "users" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
    search.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "users" })).toBeInTheDocument();

    useOverlayStore.getState().openOverlay("palette");
    const again = await screen.findByRole("textbox", { name: "Search" });
    await user.type(again, ">theme");
    expect(screen.getByRole("option", { name: "Toggle theme" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "orders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "users" })).not.toBeInTheDocument();
  });

  it("toggles density and opens a new table from the keyboard", async () => {
    const user = userEvent.setup();
    install();
    await renderAt("/c/c1", { api: "custom" });
    useOverlayStore.getState().openOverlay("palette");
    const search = await screen.findByRole("textbox", { name: "Search" });
    await user.type(search, ">density");
    await user.keyboard("{Enter}");
    expect(useUiStore.getState().density).toBe("compact");

    useOverlayStore.getState().openOverlay("palette");
    await user.type(await screen.findByRole("textbox", { name: "Search" }), ">new");
    expect(await screen.findByRole("option", { name: "New table" })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Create table" })).toBeInTheDocument();
  });

  it("switches to a saved connection", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    install((url, method) => {
      calls.push(`${method} ${url}`);
      if (url.endsWith("/api/v1/profiles") && method === "GET") {
        return json([
          {
            id: "p1",
            name: "Staging",
            endpoint: "https://dynamodb.us-east-1.amazonaws.com",
            region: "us-east-1",
            env: "staging",
            readOnly: false,
            authType: "keys",
            lastUsedAt: new Date().toISOString(),
            hasSecret: true,
          },
        ]);
      }
      if (url.endsWith("/connect") && method === "POST") {
        return json({
          connectionId: "c2",
          summary: { ...summary, name: "Staging", env: "staging", authType: "keys" },
        });
      }
      if (url.endsWith("/api/v1/connections/c2")) {
        return json({
          summary: { ...summary, name: "Staging", env: "staging", authType: "keys" },
          latencyMs: 4,
        });
      }
      return null;
    });
    await renderAt("/c/c1", { api: "custom" });
    useOverlayStore.getState().openOverlay("palette");
    await user.type(await screen.findByRole("textbox", { name: "Search" }), "stag");
    await user.keyboard("{Enter}");
    expect(await screen.findByText(/Staging ·/)).toBeInTheDocument();
    expect(
      calls.some((call) => call.startsWith("POST") && call.includes("/profiles/p1/connect")),
    ).toBe(true);
  });
});

function install(extra?: (url: string, method: string) => Response | null): void {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = init?.method ?? "GET";
    const custom = extra?.(url, method);
    if (custom !== undefined && custom !== null) {
      return Promise.resolve(custom);
    }
    if (url.endsWith("/api/v1/session")) {
      return Promise.resolve(json({ csrfToken: "csrf-1", version: "0.0.0" }));
    }
    if (url.endsWith("/api/v1/profiles")) {
      return Promise.resolve(json([]));
    }
    if (url.includes("/tables?") && method === "GET") {
      return Promise.resolve(json({ tables: ["orders", "users"] }));
    }
    if (url.includes("/api/v1/connections/") && method === "GET" && !url.includes("/tables")) {
      return Promise.resolve(json({ summary, latencyMs: 8 }));
    }
    return Promise.resolve(
      json(
        { error: { code: "NOT_FOUND", message: "Missing.", retryable: false, requestId: "req" } },
        404,
      ),
    );
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
