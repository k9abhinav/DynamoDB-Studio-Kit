import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clampDrawerWidth, DRAWER_MIN, type rowHeight } from "../lib/layout.js";
import type { TableTab } from "../lib/tables.js";

export type Density = Parameters<typeof rowHeight>[0];

export const MAX_OPEN_TABLES = 20;

interface UiState {
  density: Density;
  sidebarCollapsed: boolean;
  drawerWidth: number;
  drawerOpen: boolean;
  openTables: string[];
  lastTab: Record<string, TableTab>;
  setDensity: (density: Density) => void;
  toggleSidebar: () => void;
  setDrawerWidth: (width: number) => void;
  setDrawerOpen: (open: boolean) => void;
  openTable: (name: string) => boolean;
  closeTable: (name: string) => string | undefined;
  rememberTab: (name: string, tab: TableTab) => void;
}

export const uiDefaults = {
  density: "comfortable" as const,
  sidebarCollapsed: false,
  drawerWidth: DRAWER_MIN,
  drawerOpen: false,
  openTables: [] as string[],
  lastTab: {} as Record<string, TableTab>,
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
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
      openTable: (name) => {
        const { openTables } = get();
        if (openTables.includes(name)) {
          return true;
        }
        if (openTables.length >= MAX_OPEN_TABLES) {
          return false;
        }
        set({ openTables: [...openTables, name] });
        return true;
      },
      closeTable: (name) => {
        const { openTables } = get();
        const index = openTables.indexOf(name);
        if (index < 0) {
          return undefined;
        }
        const next = openTables.filter((item) => item !== name);
        set({ openTables: next });
        return next[index] ?? next[index - 1];
      },
      rememberTab: (name, tab) => {
        set((state) => ({ lastTab: { ...state.lastTab, [name]: tab } }));
      },
    }),
    {
      name: "dynamo-studio-ui",
      partialize: (state) => ({
        density: state.density,
        sidebarCollapsed: state.sidebarCollapsed,
        drawerWidth: state.drawerWidth,
        lastTab: state.lastTab,
      }),
    },
  ),
);
