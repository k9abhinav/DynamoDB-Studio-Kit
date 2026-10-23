import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { App } from "../app/App.js";
import { appRoutes } from "../app/router.js";
import { mockStudioApi, type MockApiMode } from "./mock-api.js";

export async function renderAt(
  path: string,
  options?: { api?: MockApiMode | "custom" },
): Promise<void> {
  const api = options?.api ?? (path.startsWith("/c/") ? "live" : "idle");
  if (api !== "custom") {
    mockStudioApi(api);
  }
  const router = createMemoryRouter(appRoutes(), { initialEntries: [path] });
  render(<App router={router} />);
  await waitFor(() => {
    if (screen.queryByRole("status", { name: "Loading" }) !== null) {
      throw new Error("Route is still loading");
    }
  });
}
