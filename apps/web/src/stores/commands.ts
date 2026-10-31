import { create } from "zustand";

export type PaletteCommand = "create-item" | "new-table" | "export";

interface CommandState {
  command: PaletteCommand | null;
  nonce: number;
  ask: (command: PaletteCommand) => void;
  clear: () => void;
}

export const useCommandStore = create<CommandState>()((set) => ({
  command: null,
  nonce: 0,
  ask: (command) => {
    set((state) => ({ command, nonce: state.nonce + 1 }));
  },
  clear: () => {
    set({ command: null });
  },
}));
