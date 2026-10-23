import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../app/providers.js";
import { ConfirmDialog } from "./ConfirmDialog.js";

describe("ConfirmDialog", () => {
  it("stays a text button until the typed name matches", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AppProviders>
        <ConfirmDialog
          open
          title="Delete orders?"
          body="This cannot be undone."
          confirmLabel="Delete orders"
          typedName="orders"
          onConfirm={onConfirm}
          onClose={() => undefined}
        />
      </AppProviders>,
    );
    const confirm = screen.getByRole("button", { name: "Delete orders" });
    expect(confirm).toHaveClass("MuiButton-text");
    expect(confirm).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Type orders to confirm" }), "orders");
    expect(confirm).toHaveClass("MuiButton-contained");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
