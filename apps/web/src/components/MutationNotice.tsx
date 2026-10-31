import Button from "@mui/material/Button";

export function MutationNotice({
  notice,
  onRetry,
  onOpenExisting,
}: {
  notice: string | null;
  onRetry: (() => void) | null;
  onOpenExisting: () => void;
}) {
  if (notice === null) {
    return null;
  }
  return (
    <div className="px-4 pb-2 text-sm" role="alert">
      {notice}
      {onRetry === null ? null : (
        <Button className="ml-2" onClick={onRetry}>
          Retry
        </Button>
      )}
      {notice.includes("already exists") ? (
        <Button className="ml-2" onClick={onOpenExisting}>
          Open existing item
        </Button>
      ) : null}
    </div>
  );
}
