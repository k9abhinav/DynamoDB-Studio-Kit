import { TableListResponse } from "@dynamo-studio/shared";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../../lib/api.js";
import { tableKeys } from "../../lib/query-keys.js";
import { visibleTableNames } from "./visible-tables.js";

export function useTables(connectionId: string, search: string, enabled = true) {
  const queryClient = useQueryClient();
  const list = useInfiniteQuery({
    queryKey: tableKeys.list(connectionId),
    initialPageParam: undefined as string | undefined,
    enabled: enabled && connectionId.length > 0,
    queryFn: ({ pageParam, signal }) =>
      fetchTablePage(
        connectionId,
        pageParam === undefined ? { signal } : { cursor: pageParam, signal },
      ),
    getNextPageParam: (page) => page.nextCursor,
  });

  const { hasNextPage, isFetching, fetchNextPage } = list;
  useEffect(() => {
    if (!hasNextPage || isFetching) {
      return;
    }
    void fetchNextPage();
  }, [hasNextPage, isFetching, fetchNextPage]);

  const loaded = list.data?.pages.flatMap((page) => page.tables) ?? [];
  const trimmed = search.trim();
  const remote = useQuery({
    queryKey: tableKeys.search(connectionId, trimmed.toLowerCase()),
    enabled: enabled && trimmed.length > 0 && hasNextPage,
    queryFn: ({ signal }) => fetchTablePage(connectionId, { search: trimmed, signal }),
  });

  return {
    names: loaded,
    visible: visibleTableNames(loaded, search, remote.data?.tables ?? [], hasNextPage),
    hasMore: hasNextPage,
    isLoading: list.isLoading,
    isRefreshing: list.isFetching && !list.isLoading,
    error: list.error,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: tableKeys.list(connectionId) });
    },
  };
}

export async function stopTableLoads(
  queryClient: QueryClient,
  connectionId: string,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: tableKeys.connection(connectionId) });
}

function fetchTablePage(
  connectionId: string,
  input: { cursor?: string; search?: string; signal: AbortSignal },
) {
  const params = new URLSearchParams({ limit: "100" });
  if (input.cursor !== undefined) {
    params.set("cursor", input.cursor);
  }
  if (input.search !== undefined) {
    params.set("search", input.search);
  }
  return api(
    `/api/v1/connections/${encodeURIComponent(connectionId)}/tables?${params.toString()}`,
    { signal: input.signal, schema: TableListResponse },
  );
}
