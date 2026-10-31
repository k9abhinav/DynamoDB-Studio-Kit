import Button from "@mui/material/Button";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTransferStore } from "./store.js";

export function ProgressToast() {
  const job = useTransferStore((state) => state.job);
  const cancel = useTransferStore((state) => state.cancel);
  const dismiss = useTransferStore((state) => state.dismiss);
  const importing = job?.kind === "import" && job.status === "running";

  useEffect(() => {
    if (!importing) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // The product copy is this sentence. preventDefault alone uses a generic browser warning.
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- required warning copy
      event.returnValue = "Import in progress";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [importing]);

  if (job === null) {
    return null;
  }
  const label = job.kind === "export" ? "Export" : job.kind === "import" ? "Import" : "Clear";
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-30 w-80 rounded-xl border border-outline bg-surface p-4"
    >
      <p className="text-sm font-medium">
        {label} {job.table}
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        {job.processed} processed, {job.written} written, {job.failed} failed
      </p>
      {job.message === undefined ? null : <p className="mt-1 text-sm">{job.message}</p>}
      <p className="mt-2 text-sm">
        <Link to={`/c/${job.connectionId}/t/${encodeURIComponent(job.table)}/items`}>
          Back to {job.table}
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        {job.status === "running" ? (
          <Button
            onClick={() => {
              cancel();
            }}
          >
            Cancel
          </Button>
        ) : (
          <Button
            onClick={() => {
              dismiss();
            }}
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
