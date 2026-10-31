import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { resetApiSession } from "../../lib/api.js";
import { PartiqlPanel } from "./PartiqlPanel.js";

vi.mock("./PartiqlCodeEditor.js", () => ({
  PartiqlCodeEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
    issues: readonly { line: number; column: number; message: string }[];
  }) => (
    <textarea
      aria-label="PartiQL statement"
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  ),
}));

function renderPanel(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetApiSession();
});

describe("PartiqlPanel", () => {
  it("confirms a mutation, stores history, and clears it", async () => {
    const user = userEvent.setup();
    const bodies: { statement?: string }[] = [];
    const headers: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/v1/session")) {
        return Promise.resolve(json({ csrfToken: "csrf-test", version: "0.0.0" }));
      }
      if (method === "GET" && url.includes("/tables/")) {
        return Promise.resolve(json(usersTable));
      }
      if (method === "GET" && url.includes("/connections/")) {
        return Promise.resolve(
          json({
            summary: {
              name: "Local",
              endpoint: "http://127.0.0.1:8000",
              region: "us-east-1",
              env: "production",
              readOnly: false,
              authType: "local",
            },
            latencyMs: 1,
          }),
        );
      }
      if (method === "POST" && url.includes("/partiql")) {
        headers.push(new Headers(init?.headers).get("x-ds-confirm") ?? "");
        if (typeof init?.body === "string") {
          bodies.push(JSON.parse(init.body) as { statement?: string });
        }
        return Promise.resolve(json({ items: [{ id: { S: "user-0001" } }], kind: "mutation" }));
      }
      return Promise.resolve(
        json(
          { error: { code: "NOT_FOUND", message: "Missing.", retryable: false, requestId: "req" } },
          404,
        ),
      );
    });
    renderPanel(
      <AppProviders>
        <PartiqlPanel connectionId="local" table="users" />
      </AppProviders>,
    );
    const field = await screen.findByLabelText("PartiQL statement");
    await user.click(screen.getByRole("button", { name: "Templates" }));
    await user.click(screen.getByRole("menuitem", { name: "Update" }));
    expect(field).toHaveValue('UPDATE "users" SET "name" = ? WHERE "id" = ?');
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("dialog", { name: "UPDATE statement" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Type users to confirm"), "users");
    await user.click(screen.getByRole("button", { name: "Run statement" }));
    expect(await screen.findByText("user-0001")).toBeInTheDocument();
    expect(headers.at(-1)).toBe("mutation");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(
      screen.getByRole("button", { name: 'UPDATE "users" SET "name" = ? WHERE "id" = ?' }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "History" })).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Save query" }));
    await user.type(screen.getByLabelText("Query name"), "Shipped");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Save query" })).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByRole("button", { name: "Shipped" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear history" }));
    expect(screen.queryByRole("button", { name: "Shipped" })).not.toBeInTheDocument();
    const stored = Object.keys(localStorage).filter((key) => key.startsWith("ds-partiql-"));
    expect(stored).toEqual([]);
    expect(JSON.stringify(bodies)).not.toMatch(/secret/u);
  });

  it("stops a running statement and returns to idle", async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/v1/session")) {
        return Promise.resolve(json({ csrfToken: "csrf-test", version: "0.0.0" }));
      }
      if (method === "GET" && url.includes("/tables/")) {
        return Promise.resolve(json(usersTable));
      }
      if (method === "GET" && url.includes("/connections/")) {
        return Promise.resolve(
          json({
            summary: {
              name: "Local",
              endpoint: "http://127.0.0.1:8000",
              region: "us-east-1",
              env: "local",
              readOnly: false,
              authType: "local",
            },
            latencyMs: 1,
          }),
        );
      }
      if (method === "POST" && url.includes("/partiql")) {
        const abort = init?.signal;
        if (abort === undefined || abort === null) {
          return Promise.reject(new Error("missing abort signal"));
        }
        signal = abort;
        return new Promise((_resolve, reject) => {
          const fail = () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          };
          if (abort.aborted) {
            fail();
            return;
          }
          abort.addEventListener("abort", fail, { once: true });
        });
      }
      return Promise.resolve(
        json(
          { error: { code: "NOT_FOUND", message: "Missing.", retryable: false, requestId: "req" } },
          404,
        ),
      );
    });
    renderPanel(
      <AppProviders>
        <PartiqlPanel connectionId="local" table="users" />
      </AppProviders>,
    );
    await user.click(await screen.findByRole("button", { name: "Templates" }));
    await user.click(screen.getByRole("menuitem", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: "Run" }));
    const stop = screen.getByRole("button", { name: "Stop" });
    await waitFor(() => {
      expect(stop).toBeEnabled();
    });
    await user.click(stop);
    await waitFor(() => {
      expect(signal?.aborted).toBe(true);
    });
    await waitFor(() => {
      expect(stop).toBeDisabled();
    });
    expect(screen.getByText("Run a statement to see items.")).toBeInTheDocument();
    expect(screen.queryByText(/failed|aborted/i)).not.toBeInTheDocument();
  });
});

const usersTable = {
  name: "users",
  status: "ACTIVE",
  arn: "arn:aws:dynamodb:us-east-1:000000000000:table/users",
  keySchema: [{ name: "id", type: "S", keyType: "HASH" }],
  attributeDefinitions: [{ name: "id", type: "S" }],
  billing: { mode: "PAY_PER_REQUEST" },
  itemCount: 1,
  sizeBytes: 10,
  gsis: [],
  lsis: [],
  ttl: { enabled: false },
  stream: { enabled: false },
  deletionProtection: false,
  createdAt: "2026-10-23T12:00:00.000Z",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
