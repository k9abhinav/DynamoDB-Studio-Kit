import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConflictDialog } from "./ConflictDialog.js";

describe("ConflictDialog", () => {
  it("shows both versions and lets the user reload or overwrite", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    const onOverwrite = vi.fn();
    render(
      <ConflictDialog
        open
        latest={{ id: { S: "a" }, email: { S: "new@b.c" } }}
        yours={{ id: { S: "a" }, email: { S: "old@b.c" } }}
        onClose={() => undefined}
        onOverwrite={onOverwrite}
        onReload={onReload}
      />,
    );
    expect(screen.getByText(/best-effort/i)).toBeInTheDocument();
    expect(screen.getByText(/old@b.c/)).toBeInTheDocument();
    expect(screen.getByText(/new@b.c/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reload latest" }));
    await user.click(screen.getByRole("button", { name: "Overwrite" }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(onOverwrite).toHaveBeenCalledOnce();
  });
});
