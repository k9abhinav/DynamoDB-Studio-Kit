import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAt } from "../../test/render.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const summary = {
  name: "Local",
  endpoint: "http://127.0.0.1:8000",
  region: "us-east-1",
  env: "local",
  readOnly: false,
  authType: "local",
};

describe("ConnectCard", () => {
  it("fills local defaults after a pause and submits on Enter", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    install((url, init) => {
      if (url.endsWith("/api/v1/session")) {
        return json({ csrfToken: "csrf-1", version: "0.0.0" });
      }
      if (url.endsWith("/api/v1/profiles")) {
        return json([]);
      }
      if (url.endsWith("/api/v1/connections") && init?.method === "POST") {
        bodies.push(JSON.parse(readBody(init.body)));
        return json({ connectionId: "c1", summary });
      }
      if (url.includes("/api/v1/connections/")) {
        return json({ summary, latencyMs: 8 });
      }
      return json(
        { error: { code: "NOT_FOUND", message: "Missing.", retryable: false, requestId: "req" } },
        404,
      );
    });
    await renderAt("/", { api: "custom" });
    const endpoint = screen.getByRole("textbox", { name: "Endpoint" });
    await user.type(endpoint, "localhost:8000");
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Local" })).toBeChecked();
    });
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Select a table" })).toBeInTheDocument();
    expect(bodies[0]).toMatchObject({
      endpoint: "http://localhost:8000",
      auth: { type: "local" },
      env: "local",
    });
  });

  it("shows the command hint and the friendly unreachable message", async () => {
    const user = userEvent.setup();
    let fail = true;
    install((url, init) => {
      if (url.endsWith("/api/v1/session")) {
        return json({ csrfToken: "csrf-1", version: "0.0.0" });
      }
      if (url.endsWith("/api/v1/profiles")) {
        return json([]);
      }
      if (url.endsWith("/api/v1/connections/test") && init?.method === "POST") {
        return json({ ok: true, latencyMs: 12, tableCountSample: 0 });
      }
      if (url.endsWith("/api/v1/connections") && init?.method === "POST") {
        if (fail) {
          return json(
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
        }
        return json({
          connectionId: "c1",
          summary: { ...summary, endpoint: "http://localhost:8000" },
        });
      }
      if (url.includes("/api/v1/connections/")) {
        return json({ summary, latencyMs: 12 });
      }
      return json(
        { error: { code: "NOT_FOUND", message: "Missing.", retryable: false, requestId: "req" } },
        404,
      );
    });
    await renderAt("/", { api: "custom" });
    const endpoint = screen.getByRole("textbox", { name: "Endpoint" });
    await user.type(endpoint, "aws dynamodb list-tables");
    expect(
      await screen.findByText("That looks like a command. Paste the endpoint URL instead."),
    ).toBeInTheDocument();

    await user.clear(endpoint);
    await user.type(endpoint, "http://127.0.0.1:9");
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(
      await screen.findByText(
        "Couldn't reach http://127.0.0.1:9. Is DynamoDB running and the URL correct?",
      ),
    ).toBeInTheDocument();

    fail = false;
    await user.clear(endpoint);
    await user.type(endpoint, "localhost:8000");
    await user.click(screen.getByRole("button", { name: "Test" }));
    expect(await screen.findByText("Connected in 12 ms")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByRole("heading", { name: "Select a table" })).toBeInTheDocument();
  });

  it("infers a region and reveals more options", async () => {
    const user = userEvent.setup();
    install((url) => {
      if (url.endsWith("/api/v1/profiles")) {
        return json([]);
      }
      return json({ csrfToken: "csrf-1", version: "0.0.0" });
    });
    await renderAt("/", { api: "custom" });
    await user.type(
      screen.getByRole("textbox", { name: "Endpoint" }),
      "dynamodb.us-west-2.amazonaws.com",
    );
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Region" })).toHaveValue("us-west-2");
    });
    expect(screen.getByRole("radio", { name: "Default credential chain" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "More options" }));
    expect(screen.getByRole("switch", { name: "Remember" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Environment" })).toHaveTextContent("Dev");
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

function readBody(body: BodyInit | null | undefined): string {
  return typeof body === "string" ? body : "";
}

function install(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    return Promise.resolve(handler(requestUrl(input), init));
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
