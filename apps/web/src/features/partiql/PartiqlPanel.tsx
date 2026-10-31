import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import {
  classifyStatement,
  leadingKeyword,
  selectWithoutWhere,
  type AttributeValue,
} from "@dynamo-studio/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { ApiError } from "../../lib/api.js";
import { partiqlKeys } from "../../lib/query-keys.js";
import { useOverlayStore } from "../../stores/overlay.js";
import { useUiStore } from "../../stores/ui.js";
import { DataGrid } from "../items/DataGrid.js";
import { orderedAttributes } from "../items/columns.js";
import { useTable } from "../tables/use-table.js";
import { TransferMenu } from "../transfer/TransferMenu.js";
import { useLiveConnection } from "../workspace/use-live-connection.js";
import { PartiqlCodeEditor } from "./PartiqlCodeEditor.js";
import {
  clearPartiqlStorage,
  partiqlFingerprint,
  readHistory,
  readSaved,
  rememberStatement,
  saveQuery,
  type HistoryEntry,
  type SavedQuery,
} from "./partiql-storage.js";
import {
  compileParameters,
  isLoopback,
  partiqlTemplates,
  visibleTable,
  type ParamDraft,
} from "./partiql-text.js";
import { usePartiql, type PartiqlRun } from "./use-partiql.js";

export function PartiqlPanel({ connectionId, table }: { connectionId: string; table: string }) {
  const queryClient = useQueryClient();
  const connection = useLiveConnection(connectionId);
  const described = useTable(connectionId, table);
  const showSnackbar = useOverlayStore((state) => state.showSnackbar);
  const setPreview = useUiStore((state) => state.setItemPreview);
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const [statement, setStatement] = useState("");
  const [params, setParams] = useState<ParamDraft[]>([]);
  const [run, setRun] = useState<PartiqlRun | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [formError, setFormError] = useState("");
  const [costDismissed, setCostDismissed] = useState(false);
  const result = usePartiql(connectionId, run, (text, page) => {
    if (fingerprint !== null) {
      rememberStatement(localStorage, fingerprint, text, new Date().toISOString());
    }
    const verb = leadingKeyword(text) ?? "Statement";
    showSnackbar(
      page.affected === undefined
        ? "The statement ran."
        : `${verb} affected ${String(page.affected)}.`,
    );
  });
  const endpoint = connection.data?.summary.endpoint;
  const region = connection.data?.summary.region;
  const env = connection.data?.summary.env ?? "local";
  const readOnly = connection.data?.summary.readOnly === true;
  const partition = described.data?.keySchema.find((key) => key.keyType === "HASH")?.name ?? "id";
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const names = orderedAttributes(items, described.data?.keySchema ?? []);
  const issue = result.error instanceof ApiError ? result.error.details?.position : undefined;
  const issues =
    issue === undefined || !(result.error instanceof Error)
      ? []
      : [{ line: issue.line, column: issue.column, message: result.error.message }];

  useEffect(() => {
    if (endpoint === undefined || region === undefined) {
      return;
    }
    let cancelled = false;
    void partiqlFingerprint(endpoint, region).then((next) => {
      if (cancelled) {
        return;
      }
      setFingerprint(next);
      setHistory(readHistory(localStorage, next).entries);
      setSaved(readSaved(localStorage, next).queries);
      setCostDismissed(sessionStorage.getItem(`ds-partiql-cost:${table}`) === "1");
    });
    return () => {
      cancelled = true;
    };
  }, [endpoint, region, table]);

  function execute(confirm: boolean): void {
    const compiled = compileParameters(params);
    if (!compiled.ok) {
      setFormError(compiled.message);
      return;
    }
    if (classifyStatement(statement) === "mutation" && readOnly) {
      setFormError("This connection is read-only");
      return;
    }
    setFormError("");
    setRun({
      statement,
      limit: 50,
      confirm,
      ...(compiled.values.length === 0 ? {} : { parameters: compiled.values }),
    });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        askRun();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  function askRun(): void {
    if (statement.trim().length === 0) {
      return;
    }
    if (classifyStatement(statement) === "mutation") {
      setConfirmOpen(true);
      return;
    }
    execute(false);
  }

  const verb = leadingKeyword(statement) ?? "Mutation";
  const tableName = visibleTable(statement);
  const showCost =
    endpoint !== undefined &&
    !isLoopback(endpoint) &&
    !costDismissed &&
    selectWithoutWhere(statement);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-outline px-3 py-2">
        <Button variant="contained" onClick={askRun}>
          Run
        </Button>
        <Button
          disabled={!result.isFetching}
          onClick={() => {
            void queryClient.cancelQueries({ queryKey: partiqlKeys.connection(connectionId) });
          }}
        >
          Stop
        </Button>
        <Button
          onClick={(event) => {
            setMenu(event.currentTarget);
          }}
        >
          Templates
        </Button>
        <Button
          onClick={() => {
            if (fingerprint !== null) {
              setHistory(readHistory(localStorage, fingerprint).entries);
              setSaved(readSaved(localStorage, fingerprint).queries);
            }
            setLibraryOpen(true);
          }}
        >
          History
        </Button>
        <Button
          onClick={() => {
            setSaveOpen(true);
          }}
        >
          Save query
        </Button>
        <TransferMenu connectionId={connectionId} table={table} readOnly={readOnly} />
        <p className="text-sm text-text-secondary">PartiQL exports the whole table.</p>
      </div>
      <Menu
        anchorEl={menu}
        open={menu !== null}
        onClose={() => {
          setMenu(null);
        }}
      >
        {partiqlTemplates(table, partition).map((template) => (
          <MenuItem
            key={template.label}
            onClick={() => {
              setStatement(template.statement);
              setMenu(null);
            }}
          >
            {template.label}
          </MenuItem>
        ))}
      </Menu>
      <div className="h-[220px] shrink-0 border-b border-outline">
        <PartiqlCodeEditor value={statement} onChange={setStatement} issues={issues} />
      </div>
      <div className="flex flex-wrap items-end gap-2 border-b border-outline px-3 py-2">
        {params.map((param, index) => (
          <TextField
            key={index}
            size="small"
            label={`Parameter ${String(index + 1)} (${param.type})`}
            value={param.text}
            onChange={(event) => {
              const next = [...params];
              const current = next[index];
              if (current === undefined) {
                return;
              }
              next[index] = { type: current.type, text: event.target.value };
              setParams(next);
            }}
          />
        ))}
        <Button
          onClick={() => {
            setParams([...params, { type: "S", text: "" }]);
          }}
        >
          Add parameter
        </Button>
      </div>
      {formError.length > 0 ? <p className="px-3 py-2 text-sm text-error">{formError}</p> : null}
      {result.isError ? (
        <p className="px-3 py-2 text-sm text-error">
          {result.error instanceof Error ? result.error.message : "The statement failed."}
        </p>
      ) : null}
      {showCost ? (
        <Alert
          severity="info"
          variant="outlined"
          className="m-3"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                sessionStorage.setItem(`ds-partiql-cost:${table}`, "1");
                setCostDismissed(true);
              }}
            >
              Dismiss scan cost hint
            </Button>
          }
        >
          This select reads the table and consumes read capacity.
        </Alert>
      ) : null}
      <div className="relative min-h-48 flex-1">
        {items.length > 0 ? (
          <DataGrid
            items={items}
            columns={names}
            keys={described.data?.keySchema ?? []}
            widths={{}}
            onWidth={() => undefined}
            rowPx={48}
            selected={new Set()}
            onSelected={() => undefined}
            onOpen={(item: Record<string, AttributeValue>) => {
              setPreview(item);
              setDrawerOpen(true);
            }}
            onNearEnd={() => {
              if (result.hasNextPage && !result.isFetchingNextPage) {
                void result.fetchNextPage();
              }
            }}
            scrollKey={`${connectionId}:${table}:partiql`}
          />
        ) : (
          <p className="px-4 py-6 text-sm text-text-secondary">Run a statement to see items.</p>
        )}
      </div>
      {result.hasNextPage ? (
        <div className="border-t border-outline px-3 py-2">
          <Button
            onClick={() => {
              void result.fetchNextPage();
            }}
          >
            Load more
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title={`${verb} statement`}
        body={
          tableName === undefined
            ? `This runs a ${verb} statement.`
            : `This runs a ${verb} statement on ${tableName}.`
        }
        confirmLabel="Run statement"
        {...(env === "production" ? { typedName: tableName ?? verb } : {})}
        onClose={() => {
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          execute(true);
        }}
      />
      <Dialog
        open={saveOpen}
        onClose={() => {
          setSaveOpen(false);
        }}
        aria-labelledby="save-query-title"
      >
        <DialogTitle id="save-query-title">Save query</DialogTitle>
        <DialogContent>
          <TextField
            className="mt-2"
            label="Query name"
            value={saveName}
            onChange={(event) => {
              setSaveName(event.target.value);
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSaveOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (
                fingerprint === null ||
                saveName.trim().length === 0 ||
                statement.trim().length === 0
              ) {
                return;
              }
              const next = saveQuery(localStorage, fingerprint, {
                name: saveName,
                statement,
                table,
              });
              setSaved(next.queries);
              setSaveName("");
              setSaveOpen(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <Drawer
        anchor="right"
        open={libraryOpen}
        onClose={() => {
          setLibraryOpen(false);
        }}
      >
        <div className="grid w-80 gap-3 p-4">
          <h2 className="text-sm font-medium">History</h2>
          <Button
            onClick={() => {
              if (fingerprint === null) {
                return;
              }
              clearPartiqlStorage(localStorage, fingerprint);
              setHistory([]);
              setSaved([]);
            }}
          >
            Clear history
          </Button>
          {history.map((entry) => (
            <Button
              key={`${entry.savedAt}-${entry.statement}`}
              onClick={() => {
                setStatement(entry.statement);
                setLibraryOpen(false);
              }}
            >
              {entry.statement}
            </Button>
          ))}
          <h2 className="text-sm font-medium">Saved queries</h2>
          <TextField
            size="small"
            label="Search saved queries"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          {saved
            .filter((query) => query.name.toLowerCase().includes(search.toLowerCase()))
            .map((query) => (
              <Button
                key={query.id}
                onClick={() => {
                  setStatement(query.statement);
                  setLibraryOpen(false);
                }}
              >
                {query.name}
              </Button>
            ))}
        </div>
      </Drawer>
    </div>
  );
}
