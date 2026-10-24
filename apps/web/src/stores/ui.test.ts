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
    expect(saved.state).not.toHaveProperty("openTables");
    expect(rowHeight("compact")).toBe("32px");
  });

  it("remembers the last tab and refuses a 21st open table", () => {
    for (let index = 0; index < 20; index += 1) {
      expect(useUiStore.getState().openTable(`table-${String(index)}`)).toBe(true);
    }
    expect(useUiStore.getState().openTable("one-more")).toBe(false);
    useUiStore.getState().rememberTab("orders", "overview");
    expect(useUiStore.getState().closeTable("table-0")).toBe("table-1");
    expect(useUiStore.getState().openTable("one-more")).toBe(true);
    const raw = localStorage.getItem("dynamo-studio-ui");
    const saved = JSON.parse(raw ?? "") as { state: { lastTab: Record<string, string> } };
    expect(saved.state.lastTab).toEqual({ orders: "overview" });
  });
});
