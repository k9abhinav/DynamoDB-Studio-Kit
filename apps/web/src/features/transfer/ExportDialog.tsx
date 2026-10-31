import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { ExportRequest, type QueryRequest } from "@dynamo-studio/shared";
import { useState } from "react";
import { apiStream } from "../../lib/api.js";
import { isLoopback } from "../partiql/partiql-text.js";
import { downloadBlob, readBlob } from "./stream.js";
import { useTransferStore } from "./store.js";

export type ExportView =
  | {
      scan: {
        filterJoiner: "and" | "or";
        filters?: QueryRequest["filters"];
        consistentRead?: boolean;
      };
    }
  | { query: Omit<QueryRequest, "cursor"> };

export function ExportDialog({
  open,
  connectionId,
  table,
  endpoint,
  view,
  onClose,
}: {
  open: boolean;
  connectionId: string;
  table: string;
  endpoint: string | undefined;
  view?: ExportView;
  onClose: () => void;
}) {
  const start = useTransferStore((state) => state.start);
  const update = useTransferStore((state) => state.update);
  const complete = useTransferStore((state) => state.complete);
  const cancel = useTransferStore((state) => state.cancel);
  const running = useTransferStore(
    (state) => state.job?.status === "running" && state.job.table === table,
  );
  const [format, setFormat] = useState<"ndjson" | "json" | "csv">("ndjson");
  const [typed, setTyped] = useState(false);
  const [scope, setScope] = useState<"view" | "all">(view === undefined ? "all" : "view");
  const [maxItems, setMaxItems] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const remote = endpoint !== undefined && !isLoopback(endpoint);
  const needsName = scope === "all" && remote;
  const ready = !needsName || confirmName === table;

  async function run(): Promise<void> {
    setError(undefined);
    const controller = new AbortController();
    start({
      kind: "export",
      table,
      connectionId,
      cancel: () => {
        controller.abort();
      },
    });
    try {
      const response = await apiStream(exportPath(connectionId, table), {
        json: exportBody({ format, typed, scope, maxItems, view }),
        signal: controller.signal,
      });
      const blob = await readBlob(response, (bytes) => {
        update({ processed: bytes });
      });
      if (controller.signal.aborted) {
        return;
      }
      downloadBlob(blob, `${table}.${format}`);
      complete("Export finished.");
      onClose();
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      setError(caught instanceof Error ? caught.message : "Couldn't export the table.");
      complete("Export failed.");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="export-title">
      <DialogTitle id="export-title">Export items</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <TextField
          select
          label="Scope"
          value={scope}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "view" || next === "all") {
              setScope(next);
            }
          }}
        >
          <MenuItem value="view" disabled={view === undefined}>
            This view
          </MenuItem>
          <MenuItem value="all">Entire table</MenuItem>
        </TextField>
        {view === undefined ? (
          <p className="text-sm text-text-secondary">PartiQL exports the whole table.</p>
        ) : (
          <p className="text-sm text-text-secondary">
            This view reads matching items again from the start. It does not continue a cursor.
          </p>
        )}
        <TextField
          select
          label="Format"
          value={format}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "ndjson" || next === "json" || next === "csv") {
              setFormat(next);
            }
          }}
        >
          <MenuItem value="ndjson">NDJSON</MenuItem>
          <MenuItem value="json">JSON</MenuItem>
          <MenuItem value="csv">CSV</MenuItem>
        </TextField>
        <TextField
          select
          label="Values"
          value={typed ? "typed" : "plain"}
          onChange={(event) => {
            setTyped(event.target.value === "typed");
          }}
        >
          <MenuItem value="plain">Plain</MenuItem>
          <MenuItem value="typed">Typed JSON</MenuItem>
        </TextField>
        <TextField
          label="Max items"
          value={maxItems}
          helperText="Leave blank to export every matching item."
          onChange={(event) => {
            setMaxItems(event.target.value);
          }}
        />
        {format === "csv" ? (
          <p className="text-sm text-text-secondary">Nested values become JSON text in one cell.</p>
        ) : null}
        {needsName ? (
          <>
            <p className="text-sm text-text-secondary">
              This reads every item and can be expensive.
            </p>
            <TextField
              label={`Type ${table} to export`}
              value={confirmName}
              onChange={(event) => {
                setConfirmName(event.target.value);
              }}
            />
          </>
        ) : null}
        {error === undefined ? null : <p className="text-sm text-error">{error}</p>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {running ? (
          <Button
            onClick={() => {
              cancel();
            }}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={!ready}
            onClick={() => {
              void run();
            }}
          >
            Export
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function exportPath(connectionId: string, table: string): string {
  return `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(table)}/export`;
}

function exportBody(input: {
  format: "ndjson" | "json" | "csv";
  typed: boolean;
  scope: "view" | "all";
  maxItems: string;
  view: ExportView | undefined;
}): ExportRequest {
  const max = input.maxItems.trim();
  const scope =
    input.scope === "all" || input.view === undefined
      ? "all"
      : "scan" in input.view
        ? { scan: input.view.scan }
        : { query: input.view.query };
  return ExportRequest.parse({
    format: input.format,
    typed: input.typed,
    scope,
    ...(max.length === 0 ? {} : { maxItems: Number(max) }),
  });
}
