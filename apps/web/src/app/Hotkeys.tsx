import { useEffect } from "react";
import { hotkeyAction, isTypingTarget, readHotkey } from "../lib/hotkeys.js";
import { useOverlayStore } from "../stores/overlay.js";
import { useUiStore } from "../stores/ui.js";

export function Hotkeys() {
  const openOverlay = useOverlayStore((state) => state.openOverlay);
  const closeOverlay = useOverlayStore((state) => state.closeOverlay);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = hotkeyAction(readHotkey(event, isTypingTarget(event.target)));
      if (action === undefined) {
        return;
      }
      if (action === "close") {
        const overlay = useOverlayStore.getState().overlay;
        const drawerOpen = useUiStore.getState().drawerOpen;
        if (overlay !== null) {
          event.preventDefault();
          closeOverlay();
          return;
        }
        if (drawerOpen) {
          event.preventDefault();
          if (useUiStore.getState().editorDirty) {
            useUiStore.getState().setDiscardPrompt(true);
            return;
          }
          useUiStore.getState().setDrawerOpen(false);
        }
        return;
      }
      event.preventDefault();
      if (action === "palette") {
        openOverlay("palette");
      } else if (action === "shortcuts") {
        openOverlay("shortcuts");
      } else {
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [closeOverlay, openOverlay, toggleSidebar]);

  return null;
}
