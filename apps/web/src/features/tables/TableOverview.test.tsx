import { TableDescription } from "@dynamo-studio/shared";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { useUiStore } from "../../stores/ui.js";
import { renderAt } from "../../test/render.js";
import { SidebarTableList } from "../workspace/SidebarTableList.js";
import { TableOverview } from "./TableOverview.js";

const orders = TableDescription.parse({
  name: "orders",
  status: "ACTIVE",
  arn: "arn:aws:dynamodb:us-east-1:000000000000:table/orders",
  keySchema: [
    { name: "userId", type: "S", keyType: "HASH" },
    { name: "createdAt", type: "S", keyType: "RANGE" },
  ],
  attributeDefinitions: [
    { name: "userId", type: "S" },
    { name: "createdAt", type: "S" },
    { name: "status", type: "S" },
  ],
  billing: { mode: "PAY_PER_REQUEST" },
  itemCount: 10000,
  sizeBytes: 2048,
  gsis: [
    {
      name: "status-createdAt-index",
      status: "ACTIVE",
      keys: [
        { name: "status", type: "S", keyType: "HASH" },
        { name: "createdAt", type: "S", keyType: "RANGE" },
      ],
      projection: { type: "ALL" },
    },
  ],
  lsis: [],
  ttl: { enabled: false },
  stream: { enabled: false },
  deletionProtection: false,
  createdAt: "2026-10-23T12:00:00.000Z",
});

function renderOverview(description: ReturnType<typeof TableDescription.parse>) {
  render(
    <AppProviders>
      <TableOverview description={description} />
    </AppProviders>,
  );
}

describe("TableOverview", () => {
  it("shows orders keys, the GSI, and an approximate count", async () => {
    const user = userEvent.setup();
    renderOverview(orders);
    expect(screen.getByText("userId")).toBeInTheDocument();
    expect(screen.getAllByText("createdAt").length).toBeGreaterThan(0);
    expect(screen.getByText("status-createdAt-index")).toBeInTheDocument();
    expect(screen.getByText("On-demand")).toBeInTheDocument();
    expect(screen.getByText(/About 10,000 items, 2\.0 KB/)).toBeInTheDocument();
    await user.hover(screen.getByRole("button", { name: "About this count" }));
    expect(await screen.findByRole("tooltip", { name: /Approximate/ })).toBeInTheDocument();
    expect(screen.queryByText(/exact/i)).not.toBeInTheDocument();
  });

  it("shows an enabled TTL attribute and a warning for an archived table", () => {
    renderOverview(
      TableDescription.parse({
        ...orders,
        name: "sessions",
        status: "ARCHIVED",
        keySchema: [{ name: "id", type: "S", keyType: "HASH" }],
        attributeDefinitions: [
          { name: "id", type: "S" },
          { name: "expiresAt", type: "N" },
        ],
        gsis: [],
        ttl: { enabled: true, attribute: "expiresAt" },
      }),
    );
    expect(screen.getByText("Enabled on expiresAt")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("copies the ARN", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderOverview(orders);
    await user.click(screen.getByRole("button", { name: "Copy ARN" }));
    expect(writeText).toHaveBeenCalledWith(orders.arn);
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
  });

  it("round-trips a dotted table name through the URL, sidebar, and overview", async () => {
    const user = userEvent.setup();
    useUiStore.getState().rememberTab("my.table-v2", "overview");
    const description = TableDescription.parse({
      ...orders,
      name: "my.table-v2",
      arn: "arn:aws:dynamodb:us-east-1:000000000000:table/my.table-v2",
    });
    function Page() {
      const params = useParams();
      return (
        <>
          <SidebarTableList tables={[{ name: "my.table-v2", items: 1 }]} />
          {params.table === "my.table-v2" && params.tab === "overview" ? (
            <TableOverview description={description} />
          ) : null}
        </>
      );
    }
    const router = createMemoryRouter([{ path: "/c/:connId/t/:table/:tab", element: <Page /> }], {
      initialEntries: ["/c/local/t/users/items"],
    });
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    await user.click(screen.getByRole("option", { name: "my.table-v2" }));
    expect(router.state.location.pathname).toBe("/c/local/t/my.table-v2/overview");
    expect(screen.getByRole("option", { name: "my.table-v2" })).toBeInTheDocument();
    expect(
      screen.getByText("arn:aws:dynamodb:us-east-1:000000000000:table/my.table-v2"),
    ).toBeInTheDocument();
  });

  it("sends a missing table back to the table list", async () => {
    const user = userEvent.setup();
    await renderAt("/c/local/t/missing-table/overview");
    expect(await screen.findByText("That table doesn't exist (anymore).")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to tables" }));
    expect(
      await screen.findByRole("heading", { name: "Pick a table to get started" }),
    ).toBeInTheDocument();
  });
});
