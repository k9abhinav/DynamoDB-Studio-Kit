import { QueryResponse, type QueryRequest } from "@dynamo-studio/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { queryKeys } from "../../lib/query-keys.js";

export function useQueryItems(
  connectionId: string,
  table: string,
  body: Omit<QueryRequest, "cursor"> | null,
) {
  return useInfiniteQuery({
    queryKey: queryKeys.table(connectionId, table, body),
    initialPageParam: undefined as string | undefined,
    enabled: body !== null && connectionId.length > 0 && table.length > 0,
    queryFn: ({ pageParam, signal }) => {
      if (body === null) {
        throw new Error("Query is not ready.");
      }
      return api(
        `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(table)}/query`,
        {
          method: "POST",
          signal,
          schema: QueryResponse,
          body: {
            ...body,
            ...(pageParam === undefined ? {} : { cursor: pageParam }),
          },
        },
      );
    },
    getNextPageParam: (page) => page.nextCursor,
  });
}
