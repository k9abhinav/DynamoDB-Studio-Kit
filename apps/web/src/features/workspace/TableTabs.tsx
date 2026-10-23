import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useNavigate, useParams } from "react-router-dom";
import { parseTableTab, TAB_LABELS, TABLE_TABS, type TableTab } from "../../lib/tables.js";

export function TableTabs() {
  const { connId = "local", table = "users", tab: rawTab } = useParams();
  const tab = parseTableTab(rawTab) ?? "items";
  const navigate = useNavigate();

  return (
    <Tabs
      value={tab}
      onChange={(_event, value: TableTab) => {
        void navigate(`/c/${connId}/t/${table}/${value}`);
      }}
      aria-label="Table sections"
    >
      {TABLE_TABS.map((item) => (
        <Tab key={item} value={item} label={TAB_LABELS[item]} />
      ))}
    </Tabs>
  );
}
