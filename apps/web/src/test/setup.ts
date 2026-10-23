import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetApiSession } from "../lib/api.js";
import { useOverlayStore } from "../stores/overlay.js";
import { uiDefaults, useUiStore } from "../stores/ui.js";

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  cleanup();
  resetApiSession();
  vi.unstubAllGlobals();
  localStorage.clear();
  useUiStore.setState(uiDefaults);
  useOverlayStore.setState({ overlay: null, snackbar: null, undo: null });
  document.documentElement.style.removeProperty("--row-height");
  document.documentElement.removeAttribute("data-color-scheme");
});
