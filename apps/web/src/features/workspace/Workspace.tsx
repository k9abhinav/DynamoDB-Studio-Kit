import { Navigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState.js";
import { parseTableTab } from "../../lib/tables.js";
import { ItemDrawer } from "./ItemDrawer.js";
import { SidebarTableList } from "./SidebarTableList.js";
import { StudioAppBar } from "./AppBar.js";
import { TableTabs } from "./TableTabs.js";
import { TabPanel } from "./TabPanel.js";
import InboxOutlined from "@mui/icons-material/InboxOutlined";

export function Workspace() {
  const { connId = "local", table, tab } = useParams();
  if (table !== undefined && tab !== undefined && parseTableTab(tab) === undefined) {
    return <Navigate to={`/c/${connId}/t/${table}/items`} replace />;
  }

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] bg-bg text-text">
      <StudioAppBar />
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
