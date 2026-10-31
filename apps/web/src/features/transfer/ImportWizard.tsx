import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import {
  ImportOptions,
  ImportPreviewResponse,
  type ImportPreviewResponse as Preview,
} from "@dynamo-studio/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiStream } from "../../lib/api.js";
import { tableKeys } from "../../lib/query-keys.js";
import { downloadBlob, readBlob, readProgress } from "./stream.js";
import { useTransferStore } from "./store.js";

const COLUMN_TYPES = ["S", "N", "BOOL", "JSON", "skip"] as const;
type ColumnType = (typeof COLUMN_TYPES)[number];

export function ImportWizard({
  open,
  connectionId,
  table,
  onClose,
}: {
  open: boolean;
  connectionId: string;
  table: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const start = useTransferStore((state) => state.start);
  const update = useTransferStore((state) => state.update);
  const complete = useTransferStore((state) => state.complete);
  const cancel = useTransferStore((state) => state.cancel);
  const running = useTransferStore(
    (state) =>
      state.job?.kind === "import" && state.job.status === "running" && state.job.table === table,
  );
  const message = useTransferStore((state) =>
    state.job?.kind === "import" && state.job.table === table ? state.job.message : undefined,
  );
  const [file, setFile] = useState<File | undefined>();
  const [preview, setPreview] = useState<Preview | undefined>();
  const [columns, setColumns] = useState<{ name: string; type: ColumnType }[]>([]);
  const [mode, setMode] = useState<"put" | "skip-existing">("put");
  const [dryRun, setDryRun] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [reportPath, setReportPath] = useState<string | undefined>();

  async function loadPreview(next: File): Promise<void> {
    setError(undefined);
    setPreview(undefined);
    setReportPath(undefined);
    const form = new FormData();
    form.append("file", next);
    try {
      const response = await apiStream(importPath(connectionId, table, true), { form });
      const parsed = ImportPreviewResponse.parse(await response.json());
      setPreview(parsed);
      setColumns(
        (parsed.inferredColumns ?? []).map((column) => ({ name: column.name, type: "S" })),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't read that file.");
    }
  }

  async function run(): Promise<void> {
    if (file === undefined || preview === undefined) {
      return;
    }
    setError(undefined);
    const controller = new AbortController();
    start({
      kind: "import",
      table,
      connectionId,
      cancel: () => {
        controller.abort();
      },
    });
    try {
      const form = new FormData();
      form.append("options", JSON.stringify(optionsBody(preview, columns, mode, dryRun)));
      form.append("file", file);
      const response = await apiStream(importPath(connectionId, table, false), {
        form,
        signal: controller.signal,
      });
      await readProgress(response, (event) => {
        update({
          processed: event.processed,
          written: event.written,
          failed: event.failed,
          duplicates: event.duplicates,
        });
        if (event.type === "done" && event.errorsReportId !== undefined) {
          setReportPath(reportUrl(connectionId, event.errorsReportId));
        }
      });
      if (!controller.signal.aborted) {
        complete(dryRun ? "Dry run finished." : "Import finished.");
        if (!dryRun) {
          await queryClient.invalidateQueries({ queryKey: ["scan", connectionId, table] });
          await queryClient.invalidateQueries({ queryKey: ["query", connectionId, table] });
          await queryClient.invalidateQueries({
            queryKey: tableKeys.detail(connectionId, table),
          });
        }
      }
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      setError(caught instanceof Error ? caught.message : "Couldn't import that file.");
      complete("Import failed.");
    }
  }

  async function downloadReport(): Promise<void> {
    if (reportPath === undefined) {
      return;
    }
    const response = await apiStream(reportPath, { method: "GET" });
    downloadBlob(await readBlob(response, () => undefined), `${table}-errors.ndjson`);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="import-title">
      <DialogTitle id="import-title">Import items</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <label className="text-sm">
          Import file
          <input
            className="mt-1 block w-full text-sm"
            type="file"
            accept=".csv,.json,.ndjson,text/csv,application/json"
            onChange={(event) => {
              const next = event.target.files?.[0];
              if (next !== undefined) {
                setFile(next);
                void loadPreview(next);
              }
            }}
          />
        </label>
        {preview === undefined ? null : (
          <pre className="max-h-40 overflow-auto rounded-lg border border-outline p-3 font-mono text-xs">
            {JSON.stringify(preview.sample, null, 2)}
          </pre>
        )}
        {preview?.detectedFormat === "csv" ? (
          <>
            <p className="text-sm text-text-secondary">
              A value like 007 stays a string unless you map that column to N.
            </p>
            {columns.map((column, index) => (
              <TextField
                key={column.name}
                select
                label={column.name}
                value={column.type}
                onChange={(event) => {
                  const next = event.target.value;
                  if (isColumnType(next)) {
                    setColumns((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, type: next } : item,
                      ),
                    );
                  }
                }}
              >
                {COLUMN_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </>
        ) : null}
        <TextField
          select
          label="Mode"
          value={mode}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "put" || next === "skip-existing") {
              setMode(next);
            }
          }}
        >
          <MenuItem value="put">Overwrite</MenuItem>
          <MenuItem value="skip-existing">Skip existing</MenuItem>
        </TextField>
        <p className="text-sm text-text-secondary">
          Skip existing is slower. Each row is its own conditional write.
        </p>
        <FormControlLabel
          control={
            <Checkbox
              checked={dryRun}
              onChange={(event) => {
                setDryRun(event.target.checked);
              }}
            />
          }
          label="Dry run"
        />
        {message === undefined ? null : <p className="text-sm">{message}</p>}
        {error === undefined ? null : <p className="text-sm text-error">{error}</p>}
        {reportPath === undefined ? null : (
          <Button
            onClick={() => {
              void downloadReport();
            }}
          >
            Download error report
          </Button>
        )}
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
            disabled={file === undefined || preview === undefined}
            onClick={() => {
              void run();
            }}
          >
            Import
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function importPath(connectionId: string, table: string, preview: boolean): string {
  const base = `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(table)}/import`;
  return preview ? `${base}/preview` : base;
}

function reportUrl(connectionId: string, reportId: string): string {
  return `/api/v1/connections/${encodeURIComponent(connectionId)}/import/errors/${encodeURIComponent(reportId)}`;
}

function optionsBody(
  preview: Preview,
  columns: { name: string; type: ColumnType }[],
  mode: "put" | "skip-existing",
  dryRun: boolean,
): ImportOptions {
  return ImportOptions.parse({
    format: preview.detectedFormat,
    mode,
    dryRun,
    ...(preview.detectedFormat === "csv"
      ? { mapping: { header: true, delimiter: ",", columns } }
      : {}),
  });
}

function isColumnType(value: string): value is ColumnType {
  return value === "S" || value === "N" || value === "BOOL" || value === "JSON" || value === "skip";
}
