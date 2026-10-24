import InboxOutlined from "@mui/icons-material/InboxOutlined";
import Button from "@mui/material/Button";
import { useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState.js";
import { TableOverview } from "../tables/TableOverview.js";
import { TablePanel } from "../tables/TablePanel.js";
import { parseTableTab } from "../../lib/tables.js";
import { useUiStore } from "../../stores/ui.js";

export function TabPanel() {
  const { tab: rawTab } = useParams();
  const tab = parseTableTab(rawTab) ?? "items";
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);

  if (tab === "items") {
    return (
      <EmptyState
        icon={<InboxOutlined className="text-[48px]" />}
        title="This table is empty"
        help="Add your first item when editing arrives."
        action={
          <Button
            variant="contained"
            onClick={() => {
              setDrawerOpen(true);
            }}
          >
            Open details
          </Button>
        }
      />
    );
  }

  if (tab === "overview") {
    return <TablePanel>{(description) => <TableOverview description={description} />}</TablePanel>;
  }

  const copy =
    tab === "partiql"
      ? "PartiQL arrives in a later version."
      : "Indexes arrive when the table is loaded.";

  return (
    <EmptyState
      icon={<InboxOutlined className="text-[48px]" />}
      title={copy}
      help="This is a mock workspace."
    />
  );
}
