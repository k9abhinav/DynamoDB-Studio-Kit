import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "./fetch-health.js";

export function App() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    <main>
      <h1>DynamoDB Studio</h1>
      {health.isPending ? <p>Checking the server…</p> : null}
      {health.isError ? (
        <p role="alert">
          Couldn&apos;t reach the server. Is it running?{" "}
          <button
            type="button"
            onClick={() => {
              void health.refetch();
            }}
          >
            Retry
          </button>
        </p>
      ) : null}
      {health.data ? <p>Server {health.data.version} is ok.</p> : null}
    </main>
  );
}
