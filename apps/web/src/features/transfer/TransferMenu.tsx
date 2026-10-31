import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { api, apiStream } from "../../lib/api.js";
import { tableKeys } from "../../lib/query-keys.js";
import { useLiveConnection } from "../workspace/use-live-connection.js";
import { ExportDialog, type ExportView } from "./ExportDialog.js";
import { ImportWizard } from "./ImportWizard.js";
import { readProgress } from "./stream.js";
import { useTransferStore } from "./store.js";

export function TransferMenu({
  connectionId,
  table,
  readOnly = false,
  itemCount,
  view,
}: {
  connectionId: string;
  table: string;
  readOnly?: boolean;
  itemCount?: number;
  view?: ExportView;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const connection = useLiveConnection(connectionId);
  const start = useTransferStore((state) => state.start);
  const update = useTransferStore((state) => state.update);
  const complete = useTransferStore((state) => state.complete);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const endpoint = connection.data?.summary.endpoint;
  const locked = readOnly ? "This connection is read-only" : undefined;

  async function removeTable(): Promise<void> {
    setDeleteOpen(false);
    try {
      await api(tablePath(connectionId, table), { method: "DELETE", body: { confirm: table } });
      await queryClient.invalidateQueries({ queryKey: tableKeys.list(connectionId) });
      void navigate(`/c/${connectionId}`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Couldn't delete the table.");
    }
  }

  async function clearTable(): Promise<void> {
    setClearOpen(false);
    const controller = new AbortController();
    start({
      kind: "clear",
      table,
      connectionId,
      cancel: () => {
        controller.abort();
      },
    });
    try {
      const response = await apiStream(`${tablePath(connectionId, table)}/clear`, {
        json: { confirm: table },
        signal: controller.signal,
      });
      await readProgress(response, (event) => {
        update({
          processed: event.processed,
          written: event.written,
          failed: event.failed,
          duplicates: event.duplicates,
        });
      });
      if (!controller.signal.aborted) {
        complete("Clear finished.");
        await queryClient.invalidateQueries({
          queryKey: tableKeys.detail(connectionId, table),
        });
      }
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      setActionError(caught instanceof Error ? caught.message : "Couldn't clear the table.");
      complete("Clear failed.");
    }
  }

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
        <MenuItem
          disabled={readOnly}
          title={locked}
          onClick={() => {
            setAnchor(null);
            setClearOpen(true);
          }}
        >
          Clear table
        </MenuItem>
        <MenuItem
          disabled={readOnly}
          title={locked}
          onClick={() => {
            setAnchor(null);
            setDeleteOpen(true);
          }}
        >
          Delete table
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
      <ConfirmDialog
        open={deleteOpen}
        title="Delete table"
        body={
          itemCount === undefined
            ? "This deletes the table."
            : `About ${String(itemCount)} items. This deletes the table.`
        }
        confirmLabel="Delete table"
        typedName={table}
        onConfirm={() => {
          void removeTable();
        }}
        onClose={() => {
          setDeleteOpen(false);
        }}
      />
      <ConfirmDialog
        open={clearOpen}
        title="Clear table"
        body="This deletes every item and keeps the table."
        confirmLabel="Clear table"
        typedName={table}
        onConfirm={() => {
          void clearTable();
        }}
        onClose={() => {
          setClearOpen(false);
        }}
      />
      <Dialog
        open={actionError !== undefined}
        onClose={() => {
          setActionError(undefined);
        }}
        aria-labelledby="transfer-error-title"
      >
        <DialogTitle id="transfer-error-title">Couldn't change the table</DialogTitle>
        <DialogContent>
          <p className="text-sm">{actionError}</p>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setActionError(undefined);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function tablePath(connectionId: string, table: string): string {
  return `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(table)}`;
}
