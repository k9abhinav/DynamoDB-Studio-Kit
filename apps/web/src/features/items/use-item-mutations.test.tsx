import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError, resetApiSession } from "../../lib/api.js";
import { batchDeleteChunked } from "./item-api.js";
import type { ScanPages } from "./scan-cache.js";
import { useItemMutations } from "./use-item-mutations.js";

const server = setupServer();

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
  resetApiSession();
});

afterAll(() => {
  server.close();
});

const scanKey = ["scan", "local", "users", 50, "and", false, []] as const;

function pages(): ScanPages {
  return {
    pages: [
      {
        items: [
          { id: { S: "a" }, email: { S: "a@b.c" } },
          { id: { S: "b" }, email: { S: "b@b.c" } },
        ],
        count: 2,
        scannedCount: 2,
        hasMore: false,
      },
    ],
    pageParams: [undefined],
  };
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function errorBody(code: string, message: string) {
  return { error: { code, message, retryable: false, requestId: "r" } };
}

describe("useItemMutations", () => {
  it("rolls the row back when the save fails", async () => {
    server.use(
      http.get("*/api/v1/session", () =>
        HttpResponse.json({ csrfToken: "csrf", version: "0.0.0" }),
      ),
      http.post("*/items/update", () =>
        HttpResponse.json(errorBody("INTERNAL", "no"), { status: 500 }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(scanKey, pages());
    const hook = renderHook(() => useItemMutations("local", "users"), {
      wrapper: wrapperFor(queryClient),
    });
    await expect(
      hook.result.current.update.mutateAsync({
        key: { id: { S: "a" } },
        item: { id: { S: "a" }, email: { S: "next@b.c" } },
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(queryClient.getQueryData<ScanPages>(scanKey)?.pages[0]?.items[0]).toEqual({
      id: { S: "a" },
      email: { S: "a@b.c" },
    });
  });

  it("opens a conflict when undo finds the saved version is gone", async () => {
    let hash = "";
    server.use(
      http.get("*/api/v1/session", () =>
        HttpResponse.json({ csrfToken: "csrf", version: "0.0.0" }),
      ),
      http.post("*/items/update", async ({ request }) => {
        const body = (await request.json()) as { expectedHash?: string };
        hash = body.expectedHash ?? "";
        return HttpResponse.json(
          errorBody("CONDITION_FAILED", "This item changed since you opened it."),
          {
            status: 409,
          },
        );
      }),
    );
    const hook = renderHook(() => useItemMutations("local", "users"), {
      wrapper: wrapperFor(new QueryClient()),
    });
    await hook.result.current.undoEdit({
      key: { id: { S: "a" } },
      previous: { id: { S: "a" }, email: { S: "old@b.c" } },
      savedHash: "saved-hash",
    });
    await waitFor(() => {
      expect(hook.result.current.conflict?.expectedHash).toBe("saved-hash");
    });
    expect(hash).toBe("saved-hash");
  });
});

describe("batchDeleteChunked", () => {
  it("sends keys in chunks of 25 and stops when cancelled", async () => {
    const sizes: number[] = [];
    server.use(
      http.get("*/api/v1/session", () =>
        HttpResponse.json({ csrfToken: "csrf", version: "0.0.0" }),
      ),
      http.post("*/items/batch-delete", async ({ request }) => {
        const body = (await request.json()) as { keys: unknown[] };
        sizes.push(body.keys.length);
        return HttpResponse.json({ deleted: body.keys.length, failed: [] });
      }),
    );
    const keys = Array.from({ length: 30 }, (_unused, index) => ({ id: { S: String(index) } }));
    const done = await batchDeleteChunked("local", "users", keys);
    expect(done).toEqual({ deleted: 30, failed: [] });
    expect(sizes).toEqual([25, 5]);

    const controller = new AbortController();
    controller.abort();
    const stopped = await batchDeleteChunked("local", "users", keys, { signal: controller.signal });
    expect(stopped).toEqual({ deleted: 0, failed: [] });
  });
});
