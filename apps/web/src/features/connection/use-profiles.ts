import { ProfileList } from "@dynamo-studio/shared";
import { useQuery } from "@tanstack/react-query";
import { api, ensureSession } from "../../lib/api.js";

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async ({ signal }) => {
      await ensureSession(signal);
      return api("/api/v1/profiles", { signal, schema: ProfileList });
    },
  });
}
