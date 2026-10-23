export const DRAWER_MIN = 420;
export const DRAWER_MAX = 720;
export const SIDEBAR_BREAKPOINT = 1100;
export const DRAWER_BREAKPOINT = 1280;

export function sidebarMode(viewportWidth: number, collapsed: boolean): "rail" | "list" {
  if (viewportWidth < SIDEBAR_BREAKPOINT) {
    return "rail";
  }
  return collapsed ? "rail" : "list";
}

export function drawerLayout(viewportWidth: number): "push" | "overlay" {
  return viewportWidth >= DRAWER_BREAKPOINT ? "push" : "overlay";
}

export function clampDrawerWidth(width: number): number {
  return Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, Math.round(width)));
}

export function rowHeight(density: "comfortable" | "compact"): "48px" | "32px" {
  return density === "compact" ? "32px" : "48px";
}
