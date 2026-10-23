import { beforeEach, describe, expect, it } from "vitest";
import { rowHeight } from "../lib/layout.js";
import { uiDefaults, useUiStore } from "./ui.js";

describe("ui store", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState(uiDefaults);
  });

  it("persists density, sidebar, and drawer width but not whether the drawer is open", () => {
    useUiStore.getState().setDensity("compact");
    useUiStore.getState().toggleSidebar();
    useUiStore.getState().setDrawerWidth(500);
    useUiStore.getState().setDrawerOpen(true);
    const raw = localStorage.getItem("dynamo-studio-ui");
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw ?? "") as { state: Record<string, unknown> };
    expect(saved.state).toMatchObject({
      density: "compact",
      sidebarCollapsed: true,
      drawerWidth: 500,
    });
    expect(saved.state).not.toHaveProperty("drawerOpen");
    expect(rowHeight("compact")).toBe("32px");
  });
});
