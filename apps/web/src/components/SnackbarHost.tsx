import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { snackbarDuration } from "../lib/snackbar-duration.js";
import { useOverlayStore } from "../stores/overlay.js";

export function SnackbarHost() {
  const message = useOverlayStore((state) => state.snackbar);
  const undo = useOverlayStore((state) => state.undo);
  const dismiss = useOverlayStore((state) => state.dismissSnackbar);
  const duration = snackbarDuration(undo !== null);

  return (
    <Snackbar
      open={message !== null}
      autoHideDuration={duration}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      message={message ?? ""}
      onClose={(_event, reason) => {
        if (reason === "clickaway") {
          return;
        }
        dismiss();
      }}
      action={
        undo === null ? undefined : (
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              undo();
              dismiss();
            }}
          >
            Undo
          </Button>
        )
      }
    />
  );
}
