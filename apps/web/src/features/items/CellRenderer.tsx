import { presentCell } from "./cell-text.js";
import type { AttributeValue } from "@dynamo-studio/shared";

export function CellRenderer({ value }: { value: AttributeValue | undefined }) {
  const view = presentCell(value);
  const chip =
    view.badge === "BOOL" ||
    view.badge === "SS" ||
    view.badge === "NS" ||
    view.badge === "BS" ||
    view.badge === "L" ||
    view.badge === "M";
  return (
    <span
      className={`flex min-w-0 items-center gap-1 truncate font-mono text-[13px] ${
        view.align === "right" ? "ml-auto" : ""
      } ${view.muted ? "text-text-disabled" : ""} ${chip ? "rounded-full border border-outline px-2" : ""}`}
      title={view.title}
    >
      {view.badge === undefined ? null : (
        <span className="rounded bg-surface-variant px-1 text-[10px] tracking-wide text-text-secondary uppercase">
          {view.badge}
        </span>
      )}
      {view.text}
    </span>
  );
}
