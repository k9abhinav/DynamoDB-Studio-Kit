import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stopTableLoads, useTables } from "./use-tables.js";
import { visibleTableNames } from "./visible-tables.js";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("visibleTableNames", () => {
  it("filters loaded names and merges a server page only while more names remain", () => {
    expect(visibleTableNames(["orders", "users"], "ord", ["orders-archive"], false)).toEqual([
      "orders",
    ]);
    expect(visibleTableNames(["orders"], "ord", ["orders", "orders-archive"], true)).toEqual([
      "orders",
      "orders-archive",
    ]);
  });
});

describe("useTables cancellation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops background paging on unmount, connection switch, and disconnect", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal !== undefined && signal !== null) {
        signals.push(signal);
      }
      if (signals.length === 1) {
        return Promise.resolve(json({ tables: ["orders"], nextCursor: "page-2" }));
      }
      return new Promise(() => undefined);
    });

    const queryClient = client();
    const { unmount } = renderHook(() => useTables("local", ""), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => {
      expect(signals.length).toBeGreaterThan(1);
    });
    const background = signals.at(-1);
    unmount();
    await waitFor(() => {
      expect(background?.aborted).toBe(true);
    });

    signals.length = 0;
    const switched = client();
    const view = renderHook(({ id }: { id: string }) => useTables(id, ""), {
      wrapper: wrapperFor(switched),
      initialProps: { id: "first" },
    });
    await waitFor(() => {
      expect(signals.length).toBeGreaterThan(1);
    });
    const switchedBackground = signals.at(-1);
    view.rerender({ id: "second" });
    await waitFor(() => {
      expect(switchedBackground?.aborted).toBe(true);
    });
    view.unmount();

    signals.length = 0;
    const disconnected = client();
    const hanging = renderHook(() => useTables("local", ""), {
      wrapper: wrapperFor(disconnected),
    });
    await waitFor(() => {
      expect(signals.length).toBeGreaterThan(1);
    });
    const live = signals.at(-1);
    await stopTableLoads(disconnected, "local");
    await waitFor(() => {
      expect(live?.aborted).toBe(true);
    });
    hanging.unmount();
  });
});
