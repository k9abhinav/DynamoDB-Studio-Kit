import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useOverlayStore } from "../stores/overlay.js";

export const APP_VERSION = "0.0.0";

declare const __DS_COMMIT__: string | undefined;

function injectedCommit(): string {
  if (typeof __DS_COMMIT__ === "string" && __DS_COMMIT__.length > 0) {
    return __DS_COMMIT__;
  }
  return "unknown";
}

export const APP_COMMIT = injectedCommit();

export function AboutDialog() {
  const open = useOverlayStore((state) => state.overlay === "about");
  const close = useOverlayStore((state) => state.closeOverlay);
  return (
    <Dialog open={open} onClose={close} aria-labelledby="about-title">
      <DialogTitle id="about-title">About</DialogTitle>
      <DialogContent>
        <p>DynamoDB Studio</p>
        <p className="text-sm text-text-secondary">Version {APP_VERSION}</p>
        <p className="text-sm text-text-secondary">Commit {APP_COMMIT}</p>
        <p className="text-sm text-text-secondary">MIT</p>
        <a className="text-sm text-primary" href="docs/USER-GUIDE.md">
          Documentation
        </a>
      </DialogContent>
    </Dialog>
  );
}
