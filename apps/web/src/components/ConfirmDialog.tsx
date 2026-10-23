import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useState } from "react";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  typedName,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  typedName?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const ready = typedName === undefined || value === typedName;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="confirm-title"
      slotProps={{
        transition: {
          onExited: () => {
            setValue("");
          },
        },
      }}
    >
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <p className="text-sm text-text-secondary">{body}</p>
        {typedName === undefined ? null : (
          <TextField
            className="mt-4"
            label={`Type ${typedName} to confirm`}
            value={value}
            fullWidth
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant={ready ? "contained" : "text"}
          disabled={!ready}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
