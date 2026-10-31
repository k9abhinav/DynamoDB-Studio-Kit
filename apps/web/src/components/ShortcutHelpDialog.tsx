import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { shortcutGroups } from "../lib/hotkeys.js";
import { useOverlayStore } from "../stores/overlay.js";

export function ShortcutHelpDialog() {
  const open = useOverlayStore((state) => state.overlay === "shortcuts");
  const close = useOverlayStore((state) => state.closeOverlay);
  return (
    <Dialog
      open={open}
      onClose={close}
      aria-labelledby="shortcuts-title"
      slotProps={{ paper: { className: "flex max-h-[70dvh] flex-col" } }}
    >
      <DialogTitle id="shortcuts-title" className="shrink-0">
        Keyboard shortcuts
      </DialogTitle>
      <DialogContent className="min-h-0 overflow-y-auto">
        {shortcutGroups().map((section) => (
          <section key={section.group} className="mt-4 first:mt-0">
            <h3 className="m-0 text-xs text-text-secondary">{section.group}</h3>
            <ul className="m-0 list-none p-0">
              {section.items.map((shortcut) => (
                <li key={shortcut.id} className="flex justify-between gap-8 py-2 text-sm">
                  <span>{shortcut.label}</span>
                  <kbd className="font-mono text-text-secondary">{shortcut.keys}</kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
