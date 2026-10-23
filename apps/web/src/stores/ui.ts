import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clampDrawerWidth, DRAWER_MIN, type rowHeight } from "../lib/layout.js";

export type Density = Parameters<typeof rowHeight>[0];

interface UiState {
  density: Density;
  sidebarCollapsed: boolean;
  drawerWidth: number;
  drawerOpen: boolean;
  setDensity: (density: Density) => void;
  toggleSidebar: () => void;
  setDrawerWidth: (width: number) => void;
  setDrawerOpen: (open: boolean) => void;
}

export const uiDefaults = {
  density: "comfortable" as const,
  sidebarCollapsed: false,
  drawerWidth: DRAWER_MIN,
  drawerOpen: false,
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ...uiDefaults,
      setDensity: (density) => {
        set({ density });
      },
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },
      setDrawerWidth: (width) => {
        set({ drawerWidth: clampDrawerWidth(width) });
      },
      setDrawerOpen: (drawerOpen) => {
        set({ drawerOpen });
      },
    }),
    {
      name: "dynamo-studio-ui",
      partialize: (state) => ({
        density: state.density,
        sidebarCollapsed: state.sidebarCollapsed,
        drawerWidth: state.drawerWidth,
      }),
    },
  ),
);
