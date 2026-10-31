import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";
import { useLiveConnection } from "../workspace/use-live-connection.js";
import { ExportDialog, type ExportView } from "./ExportDialog.js";
import { ImportWizard } from "./ImportWizard.js";

export function TransferMenu({
  connectionId,
  table,
  readOnly = false,
  view,
}: {
  connectionId: string;
  table: string;
  readOnly?: boolean;
  view?: ExportView;
}) {
  const connection = useLiveConnection(connectionId);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const endpoint = connection.data?.summary.endpoint;

  return (
    <>
      <Button
        onClick={(event) => {
          setAnchor(event.currentTarget);
        }}
      >
        Table actions
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
        }}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setExportOpen(true);
          }}
        >
          Export
        </MenuItem>
        <MenuItem
          disabled={readOnly}
          title={readOnly ? "This connection is read-only" : undefined}
          onClick={() => {
            setAnchor(null);
            setImportOpen(true);
          }}
        >
          Import
        </MenuItem>
      </Menu>
      <ExportDialog
        open={exportOpen}
        connectionId={connectionId}
        table={table}
        endpoint={endpoint}
        {...(view === undefined ? {} : { view })}
        onClose={() => {
          setExportOpen(false);
        }}
      />
      <ImportWizard
        open={importOpen}
        connectionId={connectionId}
        table={table}
        onClose={() => {
          setImportOpen(false);
        }}
      />
    </>
  );
}
