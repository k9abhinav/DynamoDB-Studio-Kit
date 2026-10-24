import { ScanResponse, type Filter } from "@dynamo-studio/shared";
import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { scanKeys } from "../../lib/query-keys.js";

export interface ScanQueryInput {
  limit: number;
  filters: readonly Filter[];
  filterJoiner: "and" | "or";
  consistentRead: boolean;
}

export function useScanItems(
  connectionId: string,
  table: string,
  query: ScanQueryInput,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: scanKeys.table(connectionId, table, query),
    initialPageParam: undefined as string | undefined,
    enabled: enabled && connectionId.length > 0 && table.length > 0,
    queryFn: ({ pageParam, signal }) =>
      api(
        `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(table)}/scan`,
        {
          method: "POST",
          signal,
          schema: ScanResponse,
          body: {
            limit: query.limit,
            filterJoiner: query.filterJoiner,
            consistentRead: query.consistentRead,
            fillPage: true,
            ...(query.filters.length === 0 ? {} : { filters: query.filters }),
            ...(pageParam === undefined ? {} : { cursor: pageParam }),
          },
        },
      ),
    getNextPageParam: (page) => page.nextCursor,
  });
}

export async function stopScans(queryClient: QueryClient, connectionId: string): Promise<void> {
  await queryClient.cancelQueries({ queryKey: scanKeys.connection(connectionId) });
}
