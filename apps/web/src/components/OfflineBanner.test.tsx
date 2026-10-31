import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppProviders } from "../app/providers.js";
import { OfflineBanner } from "./OfflineBanner.js";

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  window.dispatchEvent(new Event("online"));
});

describe("OfflineBanner", () => {
  it("appears when the browser goes offline and leaves the screen in place", () => {
    render(
      <AppProviders>
        <OfflineBanner />
        <h1>Connect to a database</h1>
      </AppProviders>,
    );
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "You're offline. This screen stays put, and changes are not queued.",
    );
    expect(screen.getByRole("heading", { name: "Connect to a database" })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });
});
