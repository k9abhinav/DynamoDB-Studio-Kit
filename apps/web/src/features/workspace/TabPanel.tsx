import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { ItemsPanel } from "../items/ItemsPanel.js";

const PartiqlPanel = lazy(() =>
  import("../partiql/PartiqlPanel.js").then((module) => ({ default: module.PartiqlPanel })),
);
import { IndexList } from "../tables/IndexList.js";
import { TableControls } from "../tables/TableControls.js";
import { TableOverview } from "../tables/TableOverview.js";
import { TablePanel } from "../tables/TablePanel.js";
import { parseTableTab } from "../../lib/tables.js";
import { useLiveConnection } from "./use-live-connection.js";

export function TabPanel() {
  const { connId = "", table = "", tab: rawTab } = useParams();
  const tab = parseTableTab(rawTab) ?? "items";
  const connection = useLiveConnection(connId);
  const readOnly = connection.data?.summary.readOnly === true;

  if (tab === "items") {
    return <ItemsPanel connectionId={connId} table={table} />;
  }

  if (tab === "overview") {
    return (
      <TablePanel>
        {(description) => (
          <TableOverview description={description} connectionId={connId} readOnly={readOnly} />
        )}
      </TablePanel>
    );
  }

  if (tab === "indexes") {
    return (
      <TablePanel>
        {(description) => (
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <section className="rounded-xl border border-outline bg-surface p-4 md:col-span-2">
              <TableControls connectionId={connId} description={description} readOnly={readOnly} />
            </section>
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
    <Suspense fallback={<p className="px-4 py-6 text-sm">Loading PartiQL</p>}>
      <PartiqlPanel connectionId={connId} table={table} />
    </Suspense>
  );
}
