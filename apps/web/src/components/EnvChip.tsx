import Chip from "@mui/material/Chip";

export type EnvName = "local" | "dev" | "staging" | "production";

const labels: Record<EnvName, string> = {
  local: "Local",
  dev: "Dev",
  staging: "Staging",
  production: "Production",
};

const dots: Record<EnvName, string> = {
  local: "bg-env-local",
  dev: "bg-env-dev",
  staging: "bg-env-staging",
  production: "bg-env-production",
};

export function EnvChip({ env }: { env: EnvName }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={labels[env]}
      icon={<span className={`ml-2 size-2 rounded-full ${dots[env]}`} />}
    />
  );
}
