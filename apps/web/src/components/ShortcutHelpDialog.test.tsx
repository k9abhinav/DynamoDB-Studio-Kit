import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../app/providers.js";
import { SHORTCUTS } from "../lib/hotkeys.js";
import { useOverlayStore } from "../stores/overlay.js";
import { ShortcutHelpDialog } from "./ShortcutHelpDialog.js";

describe("ShortcutHelpDialog", () => {
  it("lists every shortcut from the shared catalog", () => {
    useOverlayStore.setState({ overlay: "shortcuts" });
    render(
      <AppProviders>
        <ShortcutHelpDialog />
      </AppProviders>,
    );
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    for (const shortcut of SHORTCUTS) {
      expect(screen.getAllByText(shortcut.label).length).toBeGreaterThan(0);
      expect(screen.getAllByText(shortcut.keys).length).toBeGreaterThan(0);
    }
  });
});
