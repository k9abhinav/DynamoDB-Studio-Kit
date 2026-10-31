import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { ApiError, api, apiStream } from "../../lib/api.js";
import { TransferMenu } from "./TransferMenu.js";

vi.mock("../../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api.js")>("../../lib/api.js");
  return { ...actual, api: vi.fn(), apiStream: vi.fn() };
});

const mockedApi = vi.mocked(api);
const mockedStream = vi.mocked(apiStream);

const heartbeat = {
  summary: {
    name: "Local dev",
    endpoint: "http://127.0.0.1:8000",
    region: "us-east-1",
    env: "local" as const,
    readOnly: false,
    authType: "local" as const,
  },
  latencyMs: 1,
};

function renderMenu(readOnly = false) {
  const router = createMemoryRouter(
    [
      {
        path: "/c/:connId/t/:table/items",
        element: (
          <TransferMenu connectionId="local" table="notes" readOnly={readOnly} itemCount={12} />
        ),
      },
      { path: "/c/:connId", element: <p>Back at tables</p> },
    ],
    { initialEntries: ["/c/local/t/notes/items"] },
  );
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

async function confirm(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Table actions" }));
  await user.click(screen.getByRole("menuitem", { name }));
  await user.type(screen.getByLabelText("Type notes to confirm"), "notes");
  await user.click(screen.getByRole("button", { name }));
}

describe("TransferMenu", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedStream.mockReset();
    mockedApi.mockResolvedValue(heartbeat);
    mockedStream.mockResolvedValue(
      new Response(
        '{"type":"done","processed":2,"written":2,"skipped":0,"failed":0,"duplicates":0}\n',
      ),
    );
  });

  it("deletes only after the table name is typed and shows protection errors", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "Table actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete table" }));
    expect(screen.getByText("About 12 items. This deletes the table.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete table" })).toBeDisabled();
    await user.type(screen.getByLabelText("Type notes to confirm"), "notes");
    await user.click(screen.getByRole("button", { name: "Delete table" }));
    expect(await screen.findByText("Back at tables")).toBeInTheDocument();
    const deleted = mockedApi.mock.calls.find((call) => call[1]?.method === "DELETE");
    expect(deleted?.[0]).toBe("/api/v1/connections/local/tables/notes");
    expect(deleted?.[1]?.body).toEqual({ confirm: "notes" });
  });

  it("shows the friendly deletion-protection message", async () => {
    const user = userEvent.setup();
    mockedApi.mockImplementation((_path, init) => {
      if (init?.method === "DELETE") {
        return Promise.reject(
          new ApiError(400, {
            code: "VALIDATION",
            message: "Deletion protection is on. Turn it off, then delete the table.",
            retryable: false,
            requestId: "req-1",
          }),
        );
      }
      return Promise.resolve(heartbeat);
    });
    renderMenu();
    await confirm(user, "Delete table");
    expect(
      await screen.findByText("Deletion protection is on. Turn it off, then delete the table."),
    ).toBeInTheDocument();
  });

  it("clears a table only after the typed name and blocks writes when read-only", async () => {
    const user = userEvent.setup();
    renderMenu();
    await confirm(user, "Clear table");
    const cleared = mockedStream.mock.calls[0];
    expect(cleared?.[0]).toBe("/api/v1/connections/local/tables/notes/clear");
    expect(cleared?.[1].json).toEqual({ confirm: "notes" });
    expect(cleared?.[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("disables import, clear, and delete on a read-only connection", async () => {
    const user = userEvent.setup();
    renderMenu(true);
    await user.click(screen.getByRole("button", { name: "Table actions" }));
    for (const name of ["Import", "Clear table", "Delete table"]) {
      const item = screen.getByRole("menuitem", { name });
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item).toHaveAttribute("title", "This connection is read-only");
    }
  });
});
