import Skeleton from "@mui/material/Skeleton";
import type { TableDescription } from "@dynamo-studio/shared";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorState } from "../../components/ErrorState.js";
import { ApiError } from "../../lib/api.js";
import { useTable } from "./use-table.js";

export function TablePanel({ children }: { children: (table: TableDescription) => ReactNode }) {
  const navigate = useNavigate();
  const { connId = "", table = "" } = useParams();
  const query = useTable(connId, table);

  if (query.isLoading) {
    return (
      <div className="p-4" role="status" aria-label="Loading table">
        <Skeleton variant="rounded" height={120} />
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    const message = missing ? "That table doesn't exist (anymore)." : "Could not load this table.";
    const details = query.error instanceof Error ? query.error.message : "Unknown error.";
    return (
      <div className="p-4">
        <ErrorState
          message={message}
          details={details}
          onRetry={() => {
            void query.refetch();
          }}
          {...(missing
            ? {
                onBack: () => {
                  void navigate(`/c/${connId}`);
                },
              }
            : {})}
        />
      </div>
    );
  }
  return children(query.data);
}
