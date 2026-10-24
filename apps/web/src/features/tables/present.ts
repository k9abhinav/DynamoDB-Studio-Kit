import type { TableDescription } from "@dynamo-studio/shared";

export function tableStatusLabel(status: TableDescription["status"]): string {
  switch (status) {
    case "CREATING":
      return "Creating…";
    case "UPDATING":
      return "Updating…";
    case "DELETING":
      return "Deleting…";
    case "ARCHIVING":
      return "Archiving…";
    case "ARCHIVED":
      return "Archived";
    case "INACCESSIBLE_ENCRYPTION_CREDENTIALS":
      return "Encryption credentials unavailable";
    case "REPLICATION_NOT_AUTHORIZED":
      return "Replication not authorized";
    case "ACTIVE":
      return "Active";
  }
}

export function tableStatusTone(
  status: TableDescription["status"],
): "progress" | "warning" | "ready" {
  if (
    status === "CREATING" ||
    status === "UPDATING" ||
    status === "DELETING" ||
    status === "ARCHIVING"
  ) {
    return "progress";
  }
  if (
    status === "ARCHIVED" ||
    status === "INACCESSIBLE_ENCRYPTION_CREDENTIALS" ||
    status === "REPLICATION_NOT_AUTHORIZED"
  ) {
    return "warning";
  }
  return "ready";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function projectionLabel(
  projection: TableDescription["gsis"][number]["projection"],
): string {
  if (projection.type === "ALL") {
    return "All attributes";
  }
  if (projection.type === "KEYS_ONLY") {
    return "Keys only";
  }
  return `Include ${projection.nonKeyAttributes.join(", ")}`;
}
