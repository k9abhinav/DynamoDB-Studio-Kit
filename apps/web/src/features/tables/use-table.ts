import { TableDescription } from "@dynamo-studio/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { tableKeys } from "../../lib/query-keys.js";

const TRANSITIONAL = new Set(["CREATING", "UPDATING", "DELETING"]);

export const TABLE_POLL_MS = 3_000;

export function tablePollInterval(status: string | undefined): number | false {
  return status !== undefined && TRANSITIONAL.has(status) ? TABLE_POLL_MS : false;
}

export function useTable(connectionId: string, table: string, enabled = true) {
  return useQuery({
    queryKey: tableKeys.detail(connectionId, table),
    enabled: enabled && connectionId.length > 0 && table.length > 0,
    queryFn: ({ signal }) =>
      api(
        `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(table)}`,
        { signal, schema: TableDescription },
      ),
    refetchInterval: (query) => tablePollInterval(query.state.data?.status),
  });
}
