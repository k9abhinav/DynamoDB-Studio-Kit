import InboxOutlined from "@mui/icons-material/InboxOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import type { ConnectionHeartbeatBody } from "@dynamo-studio/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState.js";
import { api, ApiError } from "../../lib/api.js";
import { stopTableLoads } from "../tables/use-tables.js";
import { parseTableTab } from "../../lib/tables.js";
import { ItemDrawer } from "./ItemDrawer.js";
import { SidebarTableList } from "./SidebarTableList.js";
import { StudioAppBar, type AppBarConnection } from "./AppBar.js";
import { TableTabs } from "./TableTabs.js";
import { TabPanel } from "./TabPanel.js";
import { useLiveConnection } from "./use-live-connection.js";

export function Workspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connId = "", table, tab } = useParams();
  const query = useLiveConnection(connId);
  if (table !== undefined && tab !== undefined && parseTableTab(tab) === undefined) {
    return <Navigate to={`/c/${connId}/t/${table}/items`} replace />;
  }
  if (query.isError && isSessionMissing(query.error)) {
    return <Navigate to="/?notice=session-expired" replace />;
  }

  const lost = query.isError;
  const connection = barConnection(query.data, lost);

  async function disconnect() {
    await stopTableLoads(queryClient, connId);
    try {
      await api(`/api/v1/connections/${encodeURIComponent(connId)}`, { method: "DELETE" });
    } catch {
      // Leave the workspace even when the session is already gone.
    }
    void navigate("/");
  }

  function switchConnection() {
    void stopTableLoads(queryClient, connId);
    void navigate("/");
  }

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] bg-bg text-text">
      <div>
        <StudioAppBar
          connection={connection}
          onDisconnect={() => {
            void disconnect();
          }}
          onSwitch={switchConnection}
        />
        {lost ? (
          <div className="border-b border-outline bg-surface px-4 py-2">
            <Alert severity="warning" variant="outlined">
              Connection lost. Retry / Disconnect
              <div className="mt-2 flex gap-2">
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  Retry
                </Button>
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    void disconnect();
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </Alert>
          </div>
        ) : null}
      </div>
      <div className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)]">
        <SidebarTableList />
        <div className="flex min-w-0">
          <main className="flex min-w-0 flex-1 flex-col">
            {table === undefined ? (
              <EmptyState
                icon={<InboxOutlined className="text-[48px]" />}
                title="Select a table"
                help="Choose a table from the sidebar."
              />
            ) : (
              <>
                <div className="border-b border-outline px-4">
                  <h1 className="py-3 text-base font-medium">{table}</h1>
                  <TableTabs />
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <TabPanel />
                </div>
              </>
            )}
          </main>
          <ItemDrawer />
        </div>
      </div>
    </div>
  );
}

function isSessionMissing(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 404);
}

function barConnection(data: ConnectionHeartbeatBody | undefined, lost: boolean): AppBarConnection {
  if (data === undefined) {
    return { state: lost ? "lost" : "pending" };
  }
  return {
    state: "live",
    name: data.summary.name,
    env: data.summary.env,
    region: data.summary.region,
    latencyMs: data.latencyMs,
  };
}
