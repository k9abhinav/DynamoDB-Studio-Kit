import {
  CONFIRM_HEADER,
  PartiqlResponse,
  type AttributeValue,
  type PartiqlResponse as PartiqlResponseBody,
} from "@dynamo-studio/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { partiqlKeys } from "../../lib/query-keys.js";

export interface PartiqlRun {
  statement: string;
  parameters?: AttributeValue[];
  limit: number;
  consistentRead?: boolean;
  confirm: boolean;
}

export function usePartiql(
  connectionId: string,
  run: PartiqlRun | null,
  onSuccess?: (statement: string, page: PartiqlResponseBody) => void,
) {
  return useInfiniteQuery({
    queryKey: partiqlKeys.run(connectionId, run),
    initialPageParam: undefined as string | undefined,
    enabled: run !== null && connectionId.length > 0,
    queryFn: async ({ pageParam, signal }) => {
      if (run === null) {
        throw new Error("PartiQL is not ready.");
      }
      const page = await api(`/api/v1/connections/${encodeURIComponent(connectionId)}/partiql`, {
        method: "POST",
        signal,
        schema: PartiqlResponse,
        ...(run.confirm ? { headers: { [CONFIRM_HEADER]: "mutation" } } : {}),
        body: {
          statement: run.statement,
          limit: run.limit,
          ...(run.parameters === undefined || run.parameters.length === 0
            ? {}
            : { parameters: run.parameters }),
          ...(run.consistentRead === true ? { consistentRead: true } : {}),
          ...(pageParam === undefined ? {} : { cursor: pageParam }),
        },
      });
      if (pageParam === undefined) {
        onSuccess?.(run.statement, page);
      }
      return page;
    },
    getNextPageParam: (page) => page.nextCursor,
  });
}
