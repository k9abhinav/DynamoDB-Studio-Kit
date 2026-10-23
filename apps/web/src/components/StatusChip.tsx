import Chip from "@mui/material/Chip";
import { envDotClass, envLabel, type EnvName } from "./EnvChip.js";

export function StatusChip({
  name,
  env,
  region,
  latencyMs,
}: {
  name: string;
  env: EnvName;
  region: string;
  latencyMs: number;
}) {
  const label = `${name} · ${region} · ${String(latencyMs)}ms`;
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      aria-label={`${name}, ${envLabel(env)}, ${region}, ${String(latencyMs)} milliseconds`}
      icon={<span className={`ml-2 size-2 rounded-full ${envDotClass(env)}`} />}
    />
  );
}
