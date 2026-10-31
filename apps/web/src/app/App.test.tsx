import { act, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderAt } from "../test/render.js";

describe("App shell", () => {
  it("shows the connect card", async () => {
    await renderAt("/");
    expect(screen.getByRole("heading", { name: "DynamoDB Studio" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Endpoint" })).toHaveFocus();
  });

  it("sets --row-height from the overflow density toggle", async () => {
    const user = userEvent.setup();
    await renderAt("/c/local/t/users/items");
    expect(await screen.findByText("Local dev · us-east-1 · 12ms")).toBeInTheDocument();
    expect(screen.getByText("No tables yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "users" })).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--row-height")).toBe("48px");
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Compact" }));
    expect(document.documentElement.style.getPropertyValue("--row-height")).toBe("32px");
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Comfortable" }));
    expect(document.documentElement.style.getPropertyValue("--row-height")).toBe("48px");
  });

  it("keeps an unknown tab on Items and returns home when the connection is gone", async () => {
    const user = userEvent.setup();
    await renderAt("/c/local/t/orders/nope");
    expect(await screen.findByRole("tab", { name: "Items", selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Switch connection" }));
    expect(await screen.findByRole("textbox", { name: "Endpoint" })).toBeInTheDocument();
  });

  it("sends a missing connection back to the connect screen", async () => {
    await renderAt("/c/missing", { api: "missing" });
    expect(await screen.findByText("Session expired. Reconnect.")).toBeInTheDocument();
  });

  it("shows a connection lost banner and can disconnect", async () => {
    const user = userEvent.setup();
    await renderAt("/c/local", { api: "lost" });
    expect(await screen.findByText("Connection lost. Retry / Disconnect")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(await screen.findByRole("textbox", { name: "Endpoint" })).toBeInTheDocument();
  });

  it("keeps the current screen when the browser goes offline", async () => {
    await renderAt("/");
    expect(screen.getByRole("heading", { name: "DynamoDB Studio" })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "DynamoDB Studio" })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });

  it("uses the offline banner instead of connection lost while the browser is offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      await renderAt("/c/local", { api: "lost" });
      expect(await screen.findByText(/You're offline/)).toBeInTheDocument();
      expect(screen.queryByText("Connection lost. Retry / Disconnect")).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Pick a table to get started" }),
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      window.dispatchEvent(new Event("online"));
    }
  });

  it("reads the theme bootstrap from index.html", () => {
    const html = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../index.html"),
      "utf8",
    );
    expect(html).toContain('localStorage.getItem("mui-mode")');
    expect(html).toContain('setAttribute("data-color-scheme"');
  });
});
