import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render.js";

describe("SavedConnections", () => {
  it("connects, edits, and deletes a saved profile", async () => {
    const user = userEvent.setup();
    let profiles = [
      {
        id: "p1",
        name: "Local dev",
        endpoint: "http://localhost:8000",
        region: "us-east-1",
        env: "local",
        readOnly: false,
        authType: "local",
        lastUsedAt: new Date(Date.now() - 120_000).toISOString(),
        hasSecret: false,
      },
    ];
    const calls: { method: string; url: string; body?: unknown }[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";
      const rawBody = typeof init?.body === "string" ? init.body : undefined;
      calls.push({
        method,
        url,
        ...(rawBody === undefined ? {} : { body: JSON.parse(rawBody) as unknown }),
      });
      if (url.endsWith("/api/v1/session")) {
        return Promise.resolve(json({ csrfToken: "csrf-1", version: "0.0.0" }));
      }
      if (url.endsWith("/api/v1/profiles") && method === "GET") {
        return Promise.resolve(json(profiles));
      }
      if (url.endsWith("/api/v1/profiles/p1") && method === "PATCH") {
        const current = profiles[0];
        if (current === undefined) {
          return Promise.resolve(json([]));
        }
        const renamed = { ...current, name: "Renamed" };
        profiles = [renamed];
        return Promise.resolve(json(renamed));
      }
      if (url.endsWith("/api/v1/profiles/p1") && method === "DELETE") {
        profiles = [];
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.endsWith("/connect") && method === "POST") {
        return Promise.resolve(
          json({
            connectionId: "c1",
            summary: {
              name: "Local dev",
              endpoint: "http://localhost:8000",
              region: "us-east-1",
              env: "local",
              readOnly: false,
              authType: "local",
            },
          }),
        );
      }
      if (url.includes("/api/v1/connections/")) {
        return Promise.resolve(
          json({
            summary: {
              name: "Local dev",
              endpoint: "http://localhost:8000",
              region: "us-east-1",
              env: "local",
              readOnly: false,
              authType: "local",
            },
            latencyMs: 5,
          }),
        );
      }
      return Promise.resolve(
        json(
          { error: { code: "NOT_FOUND", message: "Missing.", retryable: false, requestId: "req" } },
          404,
        ),
      );
    });

    await renderAt("/", { api: "custom" });
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.getByText("localhost:8000")).toBeInTheDocument();
    expect(screen.getByText(/minute/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions for Local dev" }));
    expect(screen.getByRole("menuitem", { name: "Connect" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit connection" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Renamed");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Actions for Renamed" })).toBeInTheDocument();
    expect(calls.some((call) => call.method === "PATCH" && call.url.endsWith("/profiles/p1"))).toBe(
      true,
    );

    await user.click(screen.getByRole("button", { name: "Actions for Renamed" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Recent" })).not.toBeInTheDocument();
    });
  });

  it("connects from the saved list", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.endsWith("/api/v1/session")) {
        return Promise.resolve(json({ csrfToken: "csrf-1", version: "0.0.0" }));
      }
      if (url.endsWith("/api/v1/profiles")) {
        return Promise.resolve(
          json([
            {
              id: "p1",
              name: "Local dev",
              endpoint: "http://localhost:8000",
              region: "us-east-1",
              env: "local",
              readOnly: false,
              authType: "local",
              lastUsedAt: new Date().toISOString(),
              hasSecret: false,
            },
          ]),
        );
      }
      if (url.endsWith("/connect")) {
        return Promise.resolve(
          json({
            connectionId: "c1",
            summary: {
              name: "Local dev",
              endpoint: "http://localhost:8000",
              region: "us-east-1",
              env: "local",
              readOnly: false,
              authType: "local",
            },
          }),
        );
      }
      if (url.includes("/api/v1/connections/")) {
        return Promise.resolve(
          json({
            summary: {
              name: "Local dev",
              endpoint: "http://localhost:8000",
              region: "us-east-1",
              env: "local",
              readOnly: false,
              authType: "local",
            },
            latencyMs: 5,
          }),
        );
      }
      return Promise.resolve(
        json(
          { error: { code: "NOT_FOUND", message: "Missing.", retryable: false, requestId: "req" } },
          404,
        ),
      );
    });
    await renderAt("/", { api: "custom" });
    await user.click(await screen.findByRole("button", { name: "Actions for Local dev" }));
    await user.click(screen.getByRole("menuitem", { name: "Connect" }));
    expect(
      await screen.findByRole("heading", { name: "Pick a table to get started" }),
    ).toBeInTheDocument();
  });
});

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
