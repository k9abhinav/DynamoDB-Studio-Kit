import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { ApiError, api } from "../../lib/api.js";
import { CreateTableWizard } from "./CreateTableWizard.js";

vi.mock("../../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api.js")>("../../lib/api.js");
  return { ...actual, api: vi.fn() };
});

const mockedApi = vi.mocked(api);

function renderWizard() {
  const router = createMemoryRouter(
    [
      {
        path: "/c/:connId",
        element: <CreateTableWizard open connectionId="local" onClose={() => undefined} />,
      },
      { path: "/c/:connId/t/:table/:tab", element: <p>Overview</p> },
    ],
    { initialEntries: ["/c/local"] },
  );
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe("CreateTableWizard", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation((path, init) => {
      if (init?.method === "POST" && path.endsWith("/tables")) {
        return Promise.resolve({ name: "notes", status: "ACTIVE" });
      }
      return Promise.reject(
        new ApiError(404, {
          code: "NOT_FOUND",
          message: "That table doesn't exist (anymore).",
          retryable: false,
          requestId: "req",
        }),
      );
    });
  });

  it("reviews the request and creates the table", async () => {
    const user = userEvent.setup();
    const router = renderWizard();
    await user.type(screen.getByRole("textbox", { name: "Table name" }), "notes");
    await user.type(screen.getByRole("textbox", { name: "Partition key" }), "id");
    expect(await screen.findByText("Name is available.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Show request" }));
    expect(screen.getByText(/"TableName": "notes"/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(mockedApi).toHaveBeenCalledWith(
      "/api/v1/connections/local/tables",
      expect.objectContaining({ method: "POST" }),
    );
    expect(router.state.location.pathname).toBe("/c/local/t/notes/overview");
  });
});
