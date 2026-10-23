import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { App } from "./App.js";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("shows DynamoDB Studio and the server version", async () => {
    server.use(
      http.get("*/api/v1/health", () => HttpResponse.json({ ok: true, version: "0.0.0" })),
    );
    renderApp();
    expect(screen.getByRole("heading", { name: "DynamoDB Studio" })).toBeInTheDocument();
    expect(await screen.findByText("Server 0.0.0 is ok.")).toBeInTheDocument();
  });

  it("shows a retry when the server cannot be reached", async () => {
    server.use(
      http.get("*/api/v1/health", () => HttpResponse.json({ ok: false }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
    server.use(
      http.get("*/api/v1/health", () => HttpResponse.json({ ok: true, version: "0.0.0" })),
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Server 0.0.0 is ok.")).toBeInTheDocument();
  });
});
