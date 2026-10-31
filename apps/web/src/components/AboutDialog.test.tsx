import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../app/providers.js";
import { useOverlayStore } from "../stores/overlay.js";
import { AboutDialog, APP_COMMIT, APP_VERSION } from "./AboutDialog.js";

describe("AboutDialog", () => {
  it("shows the version, commit, license, and docs link", () => {
    useOverlayStore.setState({ overlay: "about" });
    render(
      <AppProviders>
        <AboutDialog />
      </AppProviders>,
    );
    expect(screen.getByRole("dialog", { name: "About" })).toBeInTheDocument();
    expect(screen.getByText(`Version ${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText(`Commit ${APP_COMMIT}`)).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      "docs/USER-GUIDE.md",
    );
  });
});
