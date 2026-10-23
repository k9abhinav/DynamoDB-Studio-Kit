import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useOverlayStore } from "../stores/overlay.js";

const shortcuts = [
  ["Search", "Ctrl K or ⌘K"],
  ["Keyboard shortcuts", "?"],
  ["Toggle sidebar", "["],
  ["Close", "Esc"],
] as const;

export function ShortcutHelpDialog() {
  const open = useOverlayStore((state) => state.overlay === "shortcuts");
  const close = useOverlayStore((state) => state.closeOverlay);
  return (
    <Dialog open={open} onClose={close} aria-labelledby="shortcuts-title">
      <DialogTitle id="shortcuts-title">Keyboard shortcuts</DialogTitle>
      <DialogContent>
        <ul className="m-0 list-none p-0">
          {shortcuts.map(([action, keys]) => (
            <li key={action} className="flex justify-between gap-8 py-2 text-sm">
              <span>{action}</span>
              <kbd className="font-mono text-text-secondary">{keys}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
