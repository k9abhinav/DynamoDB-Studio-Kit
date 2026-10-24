export function TypeBadge({ type }: { type: "S" | "N" | "B" }) {
  const label = type === "S" ? "String" : type === "N" ? "Number" : "Binary";
  return (
    <span className="rounded-full border border-outline px-2 py-0.5 text-xs text-text-secondary">
      {label}
    </span>
  );
}
