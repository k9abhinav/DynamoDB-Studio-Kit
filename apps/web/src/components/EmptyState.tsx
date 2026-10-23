import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  help,
  action,
}: {
  icon: ReactNode;
  title: string;
  help: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="text-text-disabled">{icon}</div>
      <h2 className="text-[22px] leading-7 font-normal">{title}</h2>
      <p className="text-sm text-text-secondary">{help}</p>
      {action}
    </div>
  );
}
