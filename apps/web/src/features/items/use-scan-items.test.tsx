import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetApiSession } from "../../lib/api.js";
import { useScanItems, type ScanQueryInput } from "./use-scan-items.js";

const server = setupServer();
const signals: AbortSignal[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
  server.resetHandlers();
  signals.length = 0;
  resetApiSession();
});

afterAll(() => {
  server.close();
});

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const base: ScanQueryInput = {
  limit: 50,
  filters: [],
  filterJoiner: "and",
  consistentRead: false,
};

function hangScan(): void {
  server.use(
    http.get("*/api/v1/session", () => HttpResponse.json({ csrfToken: "csrf", version: "0.0.0" })),
    http.post("*/tables/orders/scan", ({ request }) => {
      signals.push(request.signal);
      return new Promise(() => undefined);
    }),
  );
}

describe("useScanItems", () => {
  it("aborts the previous scan when the page size changes", async () => {
    hangScan();
    const queryClient = client();
    const hook = renderHook(
      ({ limit }: { limit: number }) => useScanItems("local", "orders", { ...base, limit }),
      { wrapper: wrapperFor(queryClient), initialProps: { limit: 50 } },
    );
    await waitFor(() => {
      expect(signals.length).toBe(1);
    });
    const first = signals[0];
    if (first === undefined) {
      throw new Error("expected a request");
    }
    hook.rerender({ limit: 100 });
    await waitFor(() => {
      expect(first.aborted).toBe(true);
      expect(signals.length).toBe(2);
    });
  });

  it("aborts the scan when the hook unmounts", async () => {
    hangScan();
    const hook = renderHook(() => useScanItems("local", "orders", base), {
      wrapper: wrapperFor(client()),
    });
    await waitFor(() => {
      expect(signals.length).toBe(1);
    });
    const first = signals[0];
    hook.unmount();
    await waitFor(() => {
      expect(first?.aborted).toBe(true);
    });
  });
});
