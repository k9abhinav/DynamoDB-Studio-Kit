import { TableDescription } from "@dynamo-studio/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTable } from "./use-table.js";

const base = {
  name: "orders",
  arn: "arn:aws:dynamodb:us-east-1:000000000000:table/orders",
  keySchema: [{ name: "id", type: "S", keyType: "HASH" }],
  attributeDefinitions: [{ name: "id", type: "S" }],
  billing: { mode: "PAY_PER_REQUEST" },
  itemCount: 1,
  sizeBytes: 1,
  gsis: [],
  lsis: [],
  ttl: { enabled: false },
  stream: { enabled: false },
  deletionProtection: false,
  createdAt: "2026-10-23T12:00:00.000Z",
};

function description(status: "CREATING" | "ACTIVE" | "ARCHIVED") {
  return TableDescription.parse({ ...base, status });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function wrapper(client: QueryClient) {
  return function Provider({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("table status polling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls every 3 seconds while creating and stops once the table is active", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      return Promise.resolve(json(description(calls === 1 ? "CREATING" : "ACTIVE")));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(() => useTable("local", "orders"), {
      wrapper: wrapper(client),
    });
    await advance(0);
    expect(result.current.data?.status).toBe("CREATING");
    expect(calls).toBe(1);

    await advance(2_999);
    expect(calls).toBe(1);
    await advance(1);
    rerender();
    expect(calls).toBe(2);
    expect(result.current.data?.status).toBe("ACTIVE");
    const settled = calls;
    await advance(9_000);
    expect(calls).toBe(settled);
  });

  it("does not poll an archived table", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      return Promise.resolve(json(description("ARCHIVED")));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTable("local", "orders"), { wrapper: wrapper(client) });
    await advance(0);
    expect(result.current.data?.status).toBe("ARCHIVED");
    const settled = calls;
    await advance(9_000);
    expect(calls).toBe(settled);
  });
});
