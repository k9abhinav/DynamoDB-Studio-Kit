import { create } from "zustand";

export type OverlayName = "palette" | "shortcuts" | "about";

interface OverlayState {
  overlay: OverlayName | null;
  snackbar: string | null;
  undo: (() => void) | null;
  openOverlay: (overlay: OverlayName) => void;
  closeOverlay: () => void;
  showSnackbar: (message: string, undo?: () => void) => void;
  dismissSnackbar: () => void;
}

export const useOverlayStore = create<OverlayState>()((set) => ({
  overlay: null,
  snackbar: null,
  undo: null,
  openOverlay: (overlay) => {
    set({ overlay });
  },
  closeOverlay: () => {
    set({ overlay: null });
  },
  showSnackbar: (message, undo) => {
    set({ snackbar: message, undo: undo ?? null });
  },
  dismissSnackbar: () => {
    set({ snackbar: null, undo: null });
  },
}));
