import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useOverlayStore } from "../stores/overlay.js";

export const APP_VERSION = "0.0.0";

export function AboutDialog() {
  const open = useOverlayStore((state) => state.overlay === "about");
  const close = useOverlayStore((state) => state.closeOverlay);
  return (
    <Dialog open={open} onClose={close} aria-labelledby="about-title">
      <DialogTitle id="about-title">About</DialogTitle>
      <DialogContent>
        <p>DynamoDB Studio</p>
        <p className="text-sm text-text-secondary">Version {APP_VERSION}</p>
      </DialogContent>
    </Dialog>
  );
}
