import { ConnectionHeartbeat } from "@dynamo-studio/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../../lib/api.js";

export const HEARTBEAT_MS = 30_000;

export function heartbeatInterval(visibility: DocumentVisibilityState): number | false {
  return visibility === "hidden" ? false : HEARTBEAT_MS;
}

export function useLiveConnection(connectionId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["connection", connectionId],
    queryFn: ({ signal }) =>
      api(`/api/v1/connections/${encodeURIComponent(connectionId)}`, {
        signal,
        schema: ConnectionHeartbeat,
      }),
    refetchInterval: () => heartbeatInterval(document.visibilityState),
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: ["connection", connectionId] });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [connectionId, queryClient]);

  return query;
}
