import Chip from "@mui/material/Chip";

export function StatusChip({
  env = "Local",
  latencyMs = 12,
}: {
  env?: string;
  latencyMs?: number;
}) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={`${env} · ${String(latencyMs)}ms`}
      icon={<span className="ml-2 size-2 rounded-full bg-env-local" />}
    />
  );
}
