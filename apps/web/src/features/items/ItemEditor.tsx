import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { extractKey, type Item, type ItemKeySpec } from "@dynamo-studio/shared";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { ApiError } from "../../lib/api.js";
import { useOverlayStore } from "../../stores/overlay.js";
import { useUiStore } from "../../stores/ui.js";
import { deleteConfirmation } from "./delete-confirm.js";
import { EditorPane } from "./EditorPane.js";
import {
  duplicateItem,
  formatItem,
  hashItem,
  readEditorDocument,
  type JsonMode,
} from "./editor-text.js";
import { getStoredItem } from "./item-api.js";
import { useItemMutations } from "./use-item-mutations.js";

export function ItemEditor(props: {
  connectionId: string;
  table: string;
  item: Item;
  keys: readonly ItemKeySpec[];
  kind: "view" | "create";
  env: string;
}) {
  const mutations = useItemMutations(props.connectionId, props.table);
  const showSnackbar = useOverlayStore((state) => state.showSnackbar);
  const [mode, setMode] = useState<JsonMode>("plain");
  const setPreview = useUiStore((state) => state.setItemPreview);
  const setDraftKind = useUiStore((state) => state.setDraftKind);
  const creating = props.kind === "create";
  const [editing, setEditing] = useState(creating);
  const [text, setText] = useState(() => formatItem(props.item, "plain"));
  const [baseline, setBaseline] = useState(text);
  const [hash, setHash] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [issues, setIssues] = useState(
    () => readEditorDocument(text, "plain", options(props)).issues,
  );
  const dirty = text !== baseline;
  const blocking = issues.some((issue) => issue.severity !== "warning");
  const warning = issues.find((issue) => issue.severity === "warning");
  const singleDelete = deleteConfirmation({
    count: 1,
    env: props.env,
    table: props.table,
    preview: "",
  });

  useEffect(() => {
    let cancelled = false;
    void hashItem(props.item).then((value) => {
      if (!cancelled) {
        setHash(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [props.item]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIssues(readEditorDocument(text, mode, options(props)).issues);
    }, 200);
    return () => {
      clearTimeout(timer);
    };
  }, [mode, props, text]);

  useEffect(() => {
    if (!editing) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      } else if (command && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        format();
      } else if (event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMode();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  function toggleMode(): void {
    const next: JsonMode = mode === "plain" ? "typed" : "plain";
    const read = readEditorDocument(text, mode, options(props));
    if (read.item === null) {
      setNotice("Fix the JSON before switching modes.");
      return;
    }
    const formatted = formatItem(read.item, next);
    setMode(next);
    setText(formatted);
    setBaseline(editing ? baseline : formatted);
    setNotice(null);
  }

  function format(): void {
    const read = readEditorDocument(text, mode, options(props));
    if (read.item === null) {
      return;
    }
    setText(formatItem(read.item, mode));
  }

  async function save(): Promise<void> {
    const read = readEditorDocument(text, mode, options(props));
    if (read.item === null || text === baseline || (!creating && hash === null)) {
      return;
    }
    const before = props.item;
    const key = extractKey(read.item, props.keys);
    try {
      const result = creating
        ? await mutations.create.mutateAsync({ key, item: read.item })
        : await mutations.update.mutateAsync({
            key: extractKey(before, props.keys),
            item: read.item,
            ...(hash === null ? {} : { expectedHash: hash }),
          });
      const formatted = formatItem(result.item, mode);
      setText(formatted);
      setBaseline(formatted);
      setHash(result.hash);
      setEditing(false);
      setDraftKind("view");
      setPreview(result.item);
      setNotice(
        result.weakConcurrency === true ? "Saved. The conflict check was best-effort." : null,
      );
      if (!creating) {
        showSnackbar("Saved", () => {
          void mutations.undoEdit({
            key: extractKey(before, props.keys),
            previous: before,
            savedHash: result.hash,
          });
        });
      } else {
        showSnackbar("Created");
      }
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "The save failed.");
    }
  }

  async function removeItem(): Promise<void> {
    setConfirming(false);
    const key = extractKey(props.item, props.keys);
    const result = await mutations.remove.mutateAsync(key);
    setPreview(null);
    useUiStore.getState().setDrawerOpen(false);
    if (!result.deleted || result.previousItem === undefined) {
      showSnackbar("Already deleted");
      return;
    }
    const previous = result.previousItem;
    showSnackbar("Deleted", () => {
      void mutations.create.mutateAsync({ key, item: previous });
    });
  }

  async function openExisting(): Promise<void> {
    const read = readEditorDocument(text, mode, options(props));
    if (read.item === null) {
      return;
    }
    const existing = await getStoredItem(
      props.connectionId,
      props.table,
      extractKey(read.item, props.keys),
    );
    if (existing === null) {
      setNotice("That item is not there anymore.");
      return;
    }
    setDraftKind("view");
    setPreview(existing);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 py-2">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          aria-label="JSON mode"
          onChange={(_event, next: string | null) => {
            if (next === "plain" || next === "typed") {
              toggleMode();
            }
          }}
        >
          <ToggleButton value="plain">Plain JSON</ToggleButton>
          <ToggleButton value="typed">DynamoDB JSON</ToggleButton>
        </ToggleButtonGroup>
        <div className="flex-1" />
        {editing ? (
          <Button
            variant="contained"
            disabled={!dirty || blocking || (!creating && hash === null)}
            onClick={() => void save()}
          >
            Save
          </Button>
        ) : (
          <>
            <Button
              onClick={() => {
                setDraftKind("create");
                setPreview(duplicateItem(props.item, props.keys));
              }}
            >
              Duplicate
            </Button>
            <Button
              color="error"
              onClick={() => {
                setConfirming(true);
              }}
            >
              Delete
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setEditing(true);
              }}
            >
              Edit
            </Button>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 px-4 pb-3">
        {editing ? (
          <EditorPane
            issues={issues.filter((issue) => issue.severity !== "warning")}
            value={text}
            onChange={setText}
          />
        ) : (
          <pre className="h-full overflow-auto font-mono text-[13px] leading-5">{text}</pre>
        )}
      </div>
      {warning === undefined ? null : (
        <p className="px-4 pb-2 text-sm text-warning-text">{warning.message}</p>
      )}
      {notice === null ? null : (
        <div className="px-4 pb-2 text-sm" role="alert">
          {notice}
          {notice.includes("already exists") ? (
            <Button className="ml-2" onClick={() => void openExisting()}>
              Open existing item
            </Button>
          ) : null}
        </div>
      )}
      {blocking ? (
        <ul className="px-6 pb-3 text-sm text-error">
          {issues
            .filter((issue) => issue.severity !== "warning")
            .map((issue) => (
              <li key={`${String(issue.line)}:${issue.message}`}>{issue.message}</li>
            ))}
        </ul>
      ) : null}
      {mutations.conflict === null ? null : (
        <p className="px-4 pb-3 text-sm" role="alert">
          This item changed since you opened it.
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title={singleDelete.title}
        body={JSON.stringify(extractKey(props.item, props.keys))}
        confirmLabel="Delete"
        {...(singleDelete.typedName === undefined ? {} : { typedName: singleDelete.typedName })}
        onConfirm={() => {
          void removeItem();
        }}
        onClose={() => {
          setConfirming(false);
        }}
      />
    </div>
  );
}

function options(props: { item: Item; keys: readonly ItemKeySpec[]; kind: "view" | "create" }) {
  return props.kind === "create"
    ? { keys: props.keys }
    : { keys: props.keys, original: props.item };
}
