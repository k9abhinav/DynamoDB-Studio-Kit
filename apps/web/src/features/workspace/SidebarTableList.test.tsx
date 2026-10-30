import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { MOCK_TABLES, tableOptionId } from "../../lib/tables.js";
import { useUiStore } from "../../stores/ui.js";
import { SidebarTableList } from "./SidebarTableList.js";

function renderSidebar(path = "/c/local/t/orders/items", tables = MOCK_TABLES) {
  const router = createMemoryRouter(
    [
      {
        path: "/c/:connId/t/:table/:tab",
        element: <SidebarTableList tables={tables} />,
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

describe("SidebarTableList", () => {
  it("filters, highlights, and opens the first match from the keyboard", async () => {
    const user = userEvent.setup();
    const router = renderSidebar("/c/local/t/users/items");
    const search = screen.getByRole("searchbox", { name: "Filter tables" });
    await user.type(search, "ord");
    const orders = screen.getByRole("option", { name: "orders" });
    expect(orders.querySelector("mark")).toHaveTextContent("ord");
    expect(screen.queryByRole("option", { name: "users" })).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(router.state.location.pathname).toBe("/c/local/t/orders/items");
  });

  it("reopens a table on the section you left", async () => {
    const user = userEvent.setup();
    useUiStore.getState().rememberTab("orders", "overview");
    const router = renderSidebar("/c/local/t/users/items");
    await user.click(screen.getByRole("option", { name: "orders" }));
    expect(router.state.location.pathname).toBe("/c/local/t/orders/overview");
  });

  it("moves the active option with the arrow keys and clears on escape", async () => {
    const user = userEvent.setup();
    renderSidebar();
    const search = screen.getByRole("searchbox", { name: "Filter tables" });
    await user.click(search);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox", { name: "Table names" })).toHaveAttribute(
      "aria-activedescendant",
      tableOptionId("orders"),
    );
    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
  });

  it("keeps a thousand names virtualized until the search narrows them", async () => {
    const user = userEvent.setup();
    const generated = Array.from({ length: 1000 }, (_, index) => ({
      name: `generated-${String(index).padStart(4, "0")}`,
      items: 1,
    }));
    renderSidebar("/c/local/t/generated-0000/items", generated);
    expect(screen.getByText("Tables (1000)")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "generated-0000" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "generated-0999" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Filter tables" }), "0999");
    expect(screen.getByRole("option", { name: "generated-0999" })).toBeInTheDocument();
  });

  it("refreshes from the server and marks a table that just appeared", async () => {
    const user = userEvent.setup();
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      const tables = calls === 1 ? ["orders"] : ["orders", "users"];
      return Promise.resolve(
        new Response(JSON.stringify({ tables }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    const router = createMemoryRouter([{ path: "/c/:connId", element: <SidebarTableList /> }], {
      initialEntries: ["/c/local"],
    });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByRole("option", { name: "orders" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh tables" }));
    const users = await screen.findByRole("option", { name: "users" });
    expect(users).toHaveAttribute("data-arrived", "true");
    await waitFor(() => {
      expect(calls).toBeGreaterThan(1);
    });
  });

  it("opens the create table wizard from an empty account", async () => {
    const user = userEvent.setup();
    renderSidebar("/c/local/t/users/items", []);
    expect(screen.getByText("No tables yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create table" }));
    expect(screen.getByRole("dialog", { name: "Create table" })).toBeInTheDocument();
  });
});
