import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderAt } from "../../test/render.js";

describe("ItemDrawer", () => {
  it("resizes with the keyboard and returns focus when closed", async () => {
    const user = userEvent.setup();
    await renderAt("/c/local/t/users/items");
    const open = await screen.findByText("user-0001");
    const cell = open.closest("[role='gridcell']");
    if (cell === null) {
      throw new Error("expected a grid cell");
    }
    await user.click(cell);
    const handle = screen.getByRole("separator", { name: "Resize item details" });
    expect(handle).toHaveAttribute("aria-valuenow", "420");
    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "436");
    await user.click(screen.getByRole("button", { name: "Close item details" }));
    expect(cell).toHaveFocus();
  });
});
