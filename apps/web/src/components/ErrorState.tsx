import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useState } from "react";

export function ErrorState({
  message,
  details,
  onRetry,
  onBack,
}: {
  message: string;
  details: string;
  onRetry: () => void;
  onBack?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Alert severity="error" variant="outlined" role="alert">
      <p>{message}</p>
      <div className="mt-3 flex gap-2">
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
        {onBack === undefined ? null : (
          <Button color="inherit" size="small" onClick={onBack}>
            Back to tables
          </Button>
        )}
        <Button
          color="inherit"
          size="small"
          aria-expanded={open}
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          Details
        </Button>
      </div>
      {open ? (
        <pre className="mt-3 font-mono text-[13px] leading-5 whitespace-pre-wrap">{details}</pre>
      ) : null}
    </Alert>
  );
}
