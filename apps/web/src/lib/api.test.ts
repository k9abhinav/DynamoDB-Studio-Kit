import { afterEach, describe, expect, it, vi } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";
import { api, ApiError, ensureSession, resetApiSession } from "./api.js";

afterEach(() => {
  resetApiSession();
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("loads a CSRF token and sends it on mutations", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/v1/session") {
        return jsonResponse({ csrfToken: "csrf-1", version: "0.0.0" });
      }
      expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe("csrf-1");
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    await api("/api/v1/connections/test", { method: "POST", body: { region: "us-east-1" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opens a session once before reads", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", (url: string) => {
      urls.push(url);
      if (url === "/api/v1/session") {
        return jsonResponse({ csrfToken: "csrf-1", version: "0.0.0" });
      }
      return jsonResponse([]);
    });
    await ensureSession();
    await ensureSession();
    await api("/api/v1/profiles");
    expect(urls).toEqual(["/api/v1/session", "/api/v1/profiles"]);
  });

  it("throws a typed ApiError and passes the abort signal", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return jsonResponse(
        {
          error: {
            code: "ENDPOINT_UNREACHABLE",
            message: "down",
            retryable: true,
            requestId: "req-1",
          },
        },
        502,
      );
    });
    await expect(api("/api/v1/session", { signal: controller.signal })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
