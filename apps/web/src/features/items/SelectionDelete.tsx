import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import { extractKey, type Item, type ItemKeySpec } from "@dynamo-studio/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { useOverlayStore } from "../../stores/overlay.js";
import { itemKey } from "./columns.js";
import { deleteConfirmation } from "./delete-confirm.js";
import { batchDeleteChunked } from "./item-api.js";
import { removeScanItems, type ScanPages } from "./scan-cache.js";
import { useItemMutations } from "./use-item-mutations.js";

export function SelectionDelete(props: {
  connectionId: string;
  table: string;
  env: string;
  items: readonly Item[];
  selected: ReadonlySet<string>;
  keyNames: readonly string[];
  keys: readonly ItemKeySpec[];
  enabled: boolean;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const mutations = useItemMutations(props.connectionId, props.table);
  const showSnackbar = useOverlayStore((state) => state.showSnackbar);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ deleted: number; failed: Item[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chosen = props.items.filter((item) => props.selected.has(itemKey(item, props.keyNames)));
  const targets = chosen.map((item) => extractKey(item, props.keys));
  const preview = targets
    .slice(0, 5)
    .map((key) => JSON.stringify(key))
    .join("\n");
  const confirm = deleteConfirmation({
    count: targets.length,
    env: props.env,
    table: props.table,
    preview,
  });

  async function run(): Promise<void> {
    setOpen(false);
    if (targets.length === 1) {
      const key = targets[0];
      if (key === undefined) {
        return;
      }
      const result = await mutations.remove.mutateAsync(key);
      props.onDone();
      if (!result.deleted || result.previousItem === undefined) {
        showSnackbar("Already deleted");
        return;
      }
      const previous = result.previousItem;
      showSnackbar("Deleted", () => {
        void mutations.create.mutateAsync({ key, item: previous });
      });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: targets.length });
    const result = await batchDeleteChunked(props.connectionId, props.table, targets, {
      signal: controller.signal,
      onChunk: (chunk) => {
        setProgress({ done: chunk.done, total: targets.length });
      },
    });
    setProgress(null);
    const failed = new Set(result.failed.map((key) => JSON.stringify(key)));
    const removed = targets.filter((key) => !failed.has(JSON.stringify(key)));
    queryClient.setQueriesData<ScanPages>(
      { queryKey: ["scan", props.connectionId, props.table] },
      (data) => (data === undefined ? data : removeScanItems(data, removed)),
    );
    props.onDone();
    if (result.failed.length > 0) {
      setSummary(result);
      return;
    }
    showSnackbar(`Deleted ${String(result.deleted)}, ${String(result.failed.length)} failed`);
  }

  return (
    <>
      <Button
        disabled={!props.enabled || targets.length === 0}
        onClick={() => {
          setOpen(true);
        }}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title={confirm.title}
        body={targets.length > 5 ? `${preview}\nAnd more.` : preview}
        confirmLabel="Delete"
        {...(confirm.typedName === undefined ? {} : { typedName: confirm.typedName })}
        onConfirm={() => {
          void run();
        }}
        onClose={() => {
          setOpen(false);
        }}
      />
      <Dialog open={progress !== null}>
        <DialogTitle>Deleting items</DialogTitle>
        <DialogContent>
          <p className="pb-3 text-sm">
            {progress === null
              ? ""
              : `Deleted ${String(progress.done)} of ${String(progress.total)}`}
          </p>
          <LinearProgress aria-label="Delete progress" />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              abortRef.current?.abort();
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={summary !== null}
        onClose={() => {
          setSummary(null);
        }}
      >
        <DialogTitle>Delete finished</DialogTitle>
        <DialogContent>
          <p className="text-sm">
            {summary === null
              ? ""
              : `Deleted ${String(summary.deleted)}, ${String(summary.failed.length)} failed`}
          </p>
        </DialogContent>
        <DialogActions>
          {summary !== null && summary.failed.length > 0 ? (
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(JSON.stringify(summary.failed, null, 2));
              }}
            >
              Copy failed keys
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setSummary(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
