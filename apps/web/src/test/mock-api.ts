import { vi } from "vitest";

export type MockApiMode = "idle" | "live" | "missing" | "lost";

const summary = {
  name: "Local dev",
  endpoint: "http://127.0.0.1:8000",
  region: "us-east-1",
  env: "local" as const,
  readOnly: false,
  authType: "local" as const,
};

export function mockStudioApi(mode: MockApiMode = "idle"): void {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/v1/session")) {
      return Promise.resolve(json({ csrfToken: "csrf-test", version: "0.0.0" }));
    }
    if (url.endsWith("/api/v1/profiles")) {
      return Promise.resolve(json([]));
    }
    if (url.endsWith("/api/v1/connections") && method === "GET") {
      return Promise.resolve(json([]));
    }
    if (url.includes("/api/v1/connections/") && method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (url.includes("/api/v1/connections/") && method === "GET") {
      if (mode === "missing" || mode === "idle") {
        return Promise.resolve(
          json(errorBody("NOT_FOUND", "That connection is not in this session."), 404),
        );
      }
      if (mode === "lost") {
        return Promise.resolve(json(errorBody("ENDPOINT_UNREACHABLE", "down"), 502));
      }
      return Promise.resolve(json({ summary, latencyMs: 12 }));
    }
    return Promise.resolve(json(errorBody("NOT_FOUND", "Missing."), 404));
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorBody(code: string, message: string) {
  return {
    error: {
      code,
      message,
      retryable: code === "ENDPOINT_UNREACHABLE" || code === "THROTTLED",
      requestId: "req-test",
    },
  };
}
