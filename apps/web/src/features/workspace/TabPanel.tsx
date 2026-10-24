import InboxOutlined from "@mui/icons-material/InboxOutlined";
import Button from "@mui/material/Button";
import { useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState.js";
import { IndexList } from "../tables/IndexList.js";
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

  if (tab === "indexes") {
    return (
      <TablePanel>
        {(description) => (
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <section className="rounded-xl border border-outline bg-surface p-4">
              <h2 className="mb-3 text-sm font-medium">Global secondary indexes</h2>
              <IndexList indexes={description.gsis} empty="No global secondary indexes." />
            </section>
            <section className="rounded-xl border border-outline bg-surface p-4">
              <h2 className="mb-3 text-sm font-medium">Local secondary indexes</h2>
              <IndexList indexes={description.lsis} empty="No local secondary indexes." />
            </section>
          </div>
        )}
      </TablePanel>
    );
  }

  return (
    <EmptyState
      icon={<InboxOutlined className="text-[48px]" />}
      title="PartiQL arrives in a later version."
      help="This is a mock workspace."
    />
  );
}
