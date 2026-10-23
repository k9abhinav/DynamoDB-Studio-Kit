import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderAt } from "../test/render.js";

describe("App shell", () => {
  it("offers a connect entry into the mock workspace", async () => {
    const user = userEvent.setup();
    renderAt("/");
    expect(screen.getByRole("heading", { name: "DynamoDB Studio" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Connect" }));
    expect(screen.getByRole("heading", { name: "users" })).toBeInTheDocument();
  });

  it("sets --row-height from the overflow density toggle", async () => {
    const user = userEvent.setup();
    renderAt("/c/local/t/users/items");
    expect(document.documentElement.style.getPropertyValue("--row-height")).toBe("48px");
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Compact" }));
    expect(document.documentElement.style.getPropertyValue("--row-height")).toBe("32px");
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Comfortable" }));
    expect(document.documentElement.style.getPropertyValue("--row-height")).toBe("48px");
  });

  it("filters the sidebar and keeps an unknown tab on Items", async () => {
    const user = userEvent.setup();
    renderAt("/c/local/t/orders/nope");
    expect(screen.getByRole("tab", { name: "Items", selected: true })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Filter tables" }), "edge");
    expect(screen.getByRole("link", { name: "edge-cases" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "orders" })).not.toBeInTheDocument();
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
