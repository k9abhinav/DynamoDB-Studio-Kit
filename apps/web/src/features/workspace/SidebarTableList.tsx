import TableChartOutlined from "@mui/icons-material/TableChartOutlined";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SIDEBAR_BREAKPOINT } from "../../lib/layout.js";
import { filterTables, type MockTable } from "../../lib/tables.js";
import { useOverlayStore } from "../../stores/overlay.js";
import { useUiStore } from "../../stores/ui.js";

export function SidebarTableList({ tables = [] }: { tables?: readonly MockTable[] }) {
  const [query, setQuery] = useState("");
  const narrow = useMediaQuery(`(max-width: ${String(SIDEBAR_BREAKPOINT - 1)}px)`);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const showSnackbar = useOverlayStore((state) => state.showSnackbar);
  const { connId = "local", table: selected } = useParams();
  const rail = narrow || collapsed;
  const visible = filterTables(tables, query);

  return (
    <nav
      aria-label="Tables"
      className={`flex h-full flex-col border-r border-outline bg-surface ${rail ? "w-[72px]" : "w-[280px]"}`}
    >
      <div className="flex items-center justify-between px-2 py-2">
        {rail ? null : <span className="px-2 text-sm font-medium">Tables</span>}
        {narrow ? null : (
          <IconButton
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebar}
          >
            <TableChartOutlined fontSize="small" />
          </IconButton>
        )}
      </div>
      {rail ? null : (
        <div className="px-3 pb-2">
          <TextField
            size="small"
            fullWidth
            type="search"
            label="Filter tables"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>
      )}
      {rail || visible.length > 0 ? null : (
        <p className="px-4 text-sm text-text-secondary">
          {query.trim().length === 0 ? "No tables yet." : "No matching tables."}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {visible.map((table) => {
          const current = table.name === selected;
          return (
            <li key={table.name}>
              <Tooltip title={table.name}>
                <Link
                  to={`/c/${connId}/t/${table.name}/items`}
                  aria-label={table.name}
                  aria-current={current ? "page" : undefined}
                  className={`relative flex h-10 items-center gap-2 px-3 no-underline ${
                    current
                      ? "bg-primary-container text-primary"
                      : "text-text hover:bg-surface-variant"
                  }`}
                >
                  {current ? (
                    <span className="absolute top-0 left-0 h-full w-[3px] bg-primary" />
                  ) : null}
                  <TableChartOutlined fontSize="small" />
                  {rail ? null : <span className="truncate">{table.name}</span>}
                </Link>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {rail ? null : (
        <button
          type="button"
          className="mx-3 mt-auto mb-3 h-10 rounded-full text-sm text-primary"
          onClick={() => {
            showSnackbar("Creating a table arrives in a later version.");
          }}
        >
          New table
        </button>
      )}
    </nav>
  );
}
