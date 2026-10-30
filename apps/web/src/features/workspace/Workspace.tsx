import InboxOutlined from "@mui/icons-material/InboxOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import type { ConnectionHeartbeatBody } from "@dynamo-studio/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, useBlocker, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { EmptyState } from "../../components/EmptyState.js";
import { api, ApiError } from "../../lib/api.js";
import { stopScans } from "../items/use-scan-items.js";
import { stopTableLoads } from "../tables/use-tables.js";
import { parseTableTab } from "../../lib/tables.js";
import { useOverlayStore } from "../../stores/overlay.js";
import { MAX_OPEN_TABLES, useUiStore } from "../../stores/ui.js";
import { ItemDrawer } from "./ItemDrawer.js";
import { OpenTableTabs } from "./OpenTableTabs.js";
import { SidebarTableList } from "./SidebarTableList.js";
import { StudioAppBar, type AppBarConnection } from "./AppBar.js";
import { TableTabs } from "./TableTabs.js";
import { TabPanel } from "./TabPanel.js";
import { useLiveConnection } from "./use-live-connection.js";

export function Workspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connId = "", table, tab } = useParams();
  const openTables = useUiStore((state) => state.openTables);
  const editorDirty = useUiStore((state) => state.editorDirty);
  const setEditorDirty = useUiStore((state) => state.setEditorDirty);
  const blocker = useBlocker(editorDirty);
  const query = useLiveConnection(connId);
  const blocked =
    table !== undefined && !openTables.includes(table) && openTables.length >= MAX_OPEN_TABLES;

  useEffect(() => {
    if (table === undefined) {
      return;
    }
    if (useUiStore.getState().openTable(table)) {
      return;
    }
    useOverlayStore.getState().showSnackbar("Close a table to open another.");
    const fallback = useUiStore.getState().openTables.at(-1);
    if (fallback === undefined) {
      void navigate(`/c/${connId}`, { replace: true });
      return;
    }
    const nextTab = useUiStore.getState().lastTab[fallback] ?? "items";
    void navigate(`/c/${connId}/t/${encodeURIComponent(fallback)}/${nextTab}`, { replace: true });
  }, [connId, navigate, table]);

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
    await stopScans(queryClient, connId);
    try {
      await api(`/api/v1/connections/${encodeURIComponent(connId)}`, { method: "DELETE" });
    } catch {
      // Leave the workspace even when the session is already gone.
    }
    void navigate("/");
  }

  function switchConnection() {
    void stopTableLoads(queryClient, connId);
    void stopScans(queryClient, connId);
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
      <div className="grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)] overflow-hidden">
        <SidebarTableList readOnly={query.data?.summary.readOnly === true} />
        <div className="flex min-w-0">
          <main className="flex min-w-0 flex-1 flex-col">
            <OpenTableTabs />
            {table === undefined || blocked ? (
              <EmptyState
                icon={<InboxOutlined className="text-[48px]" />}
                title="Pick a table to get started"
                help="Choose a table from the sidebar."
              />
            ) : (
              <>
                <div className="border-b border-outline px-4">
                  <h1 className="py-3 text-base font-medium">{table}</h1>
                  <TableTabs />
                </div>
                <div
                  className={`min-h-0 flex-1 ${
                    tab === undefined || parseTableTab(tab) === "items"
                      ? "flex flex-col overflow-hidden"
                      : "overflow-auto"
                  }`}
                >
                  <TabPanel />
                </div>
              </>
            )}
          </main>
          <ItemDrawer connectionId={connId} table={table ?? ""} />
          <ConfirmDialog
            open={blocker.state === "blocked"}
            title="Discard changes?"
            body="You have unsaved edits."
            confirmLabel="Discard"
            onConfirm={() => {
              setEditorDirty(false);
              if (blocker.state === "blocked") {
                blocker.proceed();
              }
            }}
            onClose={() => {
              if (blocker.state === "blocked") {
                blocker.reset();
              }
            }}
          />
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
