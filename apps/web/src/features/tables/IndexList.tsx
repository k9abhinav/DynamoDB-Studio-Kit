import type { TableDescription } from "@dynamo-studio/shared";
import { projectionLabel, tableStatusLabel } from "./present.js";
import { TypeBadge } from "./TypeBadge.js";

export function IndexList({
  indexes,
  empty,
}: {
  indexes: readonly TableDescription["gsis"][number][];
  empty: string;
}) {
  if (indexes.length === 0) {
    return <p className="text-sm text-text-secondary">{empty}</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {indexes.map((index) => (
        <li key={index.name} className="border-b border-outline pb-3 last:border-b-0">
          <p className="font-mono text-sm">{index.name}</p>
          <p className="text-sm text-text-secondary">{tableStatusLabel(index.status)}</p>
          {index.status === "CREATING" ? (
            <p className="text-sm">This index is still backfilling.</p>
          ) : null}
          <div className="mt-2 flex flex-col gap-1">
            {index.keys.map((key) => (
              <p key={key.keyType} className="flex items-center gap-2 text-sm">
                <span>{key.keyType === "HASH" ? "Partition key" : "Sort key"}</span>
                <span className="font-mono">{key.name}</span>
                <TypeBadge type={key.type} />
              </p>
            ))}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{projectionLabel(index.projection)}</p>
        </li>
      ))}
    </ul>
  );
}
