import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { MOCK_TABLES } from "../../lib/tables.js";
import { SidebarTableList } from "./SidebarTableList.js";

describe("SidebarTableList fixtures", () => {
  it("filters the fixture tables", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: "/c/:connId/t/:table/:tab",
          element: <SidebarTableList tables={MOCK_TABLES} />,
        },
      ],
      { initialEntries: ["/c/local/t/orders/items"] },
    );
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await user.type(screen.getByRole("searchbox", { name: "Filter tables" }), "edge");
    expect(screen.getByRole("link", { name: "edge-cases" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "orders" })).not.toBeInTheDocument();
  });
});
