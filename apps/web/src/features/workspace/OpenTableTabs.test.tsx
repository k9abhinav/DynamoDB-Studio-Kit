import { fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useUiStore } from "../../stores/ui.js";
import { renderAt } from "../../test/render.js";

describe("open table tabs", () => {
  it("closes the active tab onto its neighbor and the last tab back to the start", async () => {
    const user = userEvent.setup();
    useUiStore.getState().openTable("users");
    await renderAt("/c/local/t/orders/items");
    expect(await screen.findByRole("tab", { name: "orders", selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close orders" }));
    expect(await screen.findByRole("heading", { name: "users" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close users" }));
    expect(
      await screen.findByRole("heading", { name: "Pick a table to get started" }),
    ).toBeInTheDocument();
  });

  it("closes a tab on middle click", async () => {
    await renderAt("/c/local/t/sessions/items");
    fireEvent(
      await screen.findByRole("tab", { name: "sessions" }),
      new MouseEvent("auxclick", { bubbles: true, button: 1 }),
    );
    expect(
      await screen.findByRole("heading", { name: "Pick a table to get started" }),
    ).toBeInTheDocument();
  });

  it("asks you to close a table before opening a 21st", async () => {
    for (let index = 0; index < 20; index += 1) {
      useUiStore.getState().openTable(`kept-${String(index).padStart(2, "0")}`);
    }
    await renderAt("/c/local/t/extra-table/items");
    expect(await screen.findByText("Close a table to open another.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "extra-table" })).not.toBeInTheDocument();
  });

  it("remembers the section that was open", async () => {
    await renderAt("/c/local/t/orders/overview");
    await waitFor(() => {
      expect(useUiStore.getState().lastTab.orders).toBe("overview");
    });
  });
});
