import { TableDescription } from "@dynamo-studio/shared";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { api } from "../../lib/api.js";
import { TableControls } from "./TableControls.js";

vi.mock("../../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api.js")>("../../lib/api.js");
  return { ...actual, api: vi.fn() };
});

const mockedApi = vi.mocked(api);

const orders = TableDescription.parse({
  name: "orders",
  status: "ACTIVE",
  arn: "arn:aws:dynamodb:us-east-1:000000000000:table/orders",
  keySchema: [{ name: "id", type: "S", keyType: "HASH" }],
  attributeDefinitions: [{ name: "id", type: "S" }],
  billing: { mode: "PAY_PER_REQUEST" },
  itemCount: 2,
  sizeBytes: 100,
  gsis: [],
  lsis: [],
  ttl: { enabled: false },
  stream: { enabled: false },
  deletionProtection: false,
  createdAt: "2026-10-23T12:00:00.000Z",
});

function renderControls(readOnly = false, description = orders) {
  return render(
    <AppProviders>
      <TableControls connectionId="local" description={description} readOnly={readOnly} />
    </AppProviders>,
  );
}

describe("TableControls", () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockResolvedValue(orders);
  });

  it("turns deletion protection on and blocks index changes while one is in flight", async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByRole("switch", { name: "Deletion protection" }));
    expect(mockedApi).toHaveBeenCalledWith(
      "/api/v1/connections/local/tables/orders",
      expect.objectContaining({
        method: "PATCH",
        body: { deletionProtection: true },
      }),
    );
  });

  it("explains that only one index change can run", () => {
    renderControls(
      false,
      TableDescription.parse({
        ...orders,
        gsis: [
          {
            name: "status-index",
            status: "CREATING",
            keys: [{ name: "status", type: "S", keyType: "HASH" }],
            projection: { type: "KEYS_ONLY" },
          },
        ],
      }),
    );
    expect(screen.getByText(/Wait until status-index is ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText(/still backfilling/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add index" })).toBeDisabled();
  });

  it("disables changes on a read-only connection", () => {
    renderControls(true);
    expect(screen.getByRole("switch", { name: "Deletion protection" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add index" })).toBeDisabled();
  });
});
