import { TableDescription } from "@dynamo-studio/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render.js";
import { IndexList } from "./IndexList.js";

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
  itemCount: 10,
  sizeBytes: 100,
  gsis: [
    {
      name: "status-createdAt-index",
      status: "CREATING",
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

describe("indexes", () => {
  it("explains that a creating index is still backfilling", () => {
    render(<IndexList indexes={orders.gsis} empty="No global secondary indexes." />);
    expect(screen.getByText("status-createdAt-index")).toBeInTheDocument();
    expect(screen.getByText("This index is still backfilling.")).toBeInTheDocument();
  });

  it("shows the read-only index list for the open table", async () => {
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      const body = url.includes("/tables/orders")
        ? orders
        : url.includes("/tables")
          ? { tables: ["orders"] }
          : {
              summary: {
                name: "Local dev",
                endpoint: "http://127.0.0.1:8000",
                region: "us-east-1",
                env: "local",
                readOnly: false,
                authType: "local",
              },
              latencyMs: 12,
            };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    await renderAt("/c/local/t/orders/indexes", { api: "custom" });
    expect(await screen.findByRole("tab", { name: "Indexes", selected: true })).toBeInTheDocument();
    expect(screen.getByText("status-createdAt-index")).toBeInTheDocument();
    expect(screen.getByText("This index is still backfilling.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create index/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete index/i })).not.toBeInTheDocument();
  });
});
