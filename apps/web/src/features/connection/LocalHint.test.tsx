import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render.js";
import { LOCAL_HINT_COMMAND } from "./local-hint.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalHint", () => {
  it("shows the DynamoDB Local command until it is dismissed", async () => {
    const user = userEvent.setup();
    const urls: string[] = [];
    install((url) => {
      urls.push(url);
      if (url.endsWith("/api/v1/session")) {
        return json({ csrfToken: "csrf-1", version: "0.0.0" });
      }
      if (url.endsWith("/api/v1/profiles")) {
        return json([]);
      }
      return json({ csrfToken: "csrf-1", version: "0.0.0" });
    });
    await renderAt("/", { api: "custom" });
    expect(await screen.findByText(LOCAL_HINT_COMMAND)).toBeInTheDocument();
    expect(urls[0]).toMatch(/\/api\/v1\/session$/);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(LOCAL_HINT_COMMAND)).not.toBeInTheDocument();
    expect(localStorage.getItem("ds-local-hint-dismissed")).toBe("1");
  });

  it("stays hidden when a connection is already saved", async () => {
    install((url) => {
      if (url.endsWith("/api/v1/session")) {
        return json({ csrfToken: "csrf-1", version: "0.0.0" });
      }
      if (url.endsWith("/api/v1/profiles")) {
        return json([
          {
            id: "p1",
            name: "Local dev",
            endpoint: "http://localhost:8000",
            region: "us-east-1",
            env: "local",
            readOnly: false,
            authType: "local",
            lastUsedAt: new Date().toISOString(),
            hasSecret: false,
          },
        ]);
      }
      return json({ csrfToken: "csrf-1", version: "0.0.0" });
    });
    await renderAt("/", { api: "custom" });
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.queryByText(LOCAL_HINT_COMMAND)).not.toBeInTheDocument();
  });
});

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function install(handler: (url: string) => Response) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => Promise.resolve(handler(requestUrl(input))));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
