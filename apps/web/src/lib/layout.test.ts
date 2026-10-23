import { describe, expect, it } from "vitest";
import { clampDrawerWidth, drawerLayout, rowHeight, sidebarMode } from "./layout.js";

describe("shell layout", () => {
  it("forces the rail below 1100px without needing the saved preference", () => {
    expect(sidebarMode(1024, false)).toBe("rail");
    expect(sidebarMode(1100, false)).toBe("list");
    expect(sidebarMode(1280, true)).toBe("rail");
  });

  it("pushes the drawer from 1280px and overlays below", () => {
    expect(drawerLayout(1279)).toBe("overlay");
    expect(drawerLayout(1280)).toBe("push");
  });

  it("keeps the drawer between 420 and 720", () => {
    expect(clampDrawerWidth(100)).toBe(420);
    expect(clampDrawerWidth(500)).toBe(500);
    expect(clampDrawerWidth(900)).toBe(720);
  });

  it("maps density to the row-height variable", () => {
    expect(rowHeight("comfortable")).toBe("48px");
    expect(rowHeight("compact")).toBe("32px");
  });
});
