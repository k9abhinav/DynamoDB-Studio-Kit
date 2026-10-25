import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { extractKey, type Item, type ItemKeySpec } from "@dynamo-studio/shared";
import { useEffect, useState } from "react";
import { ApiError } from "../../lib/api.js";
import { useOverlayStore } from "../../stores/overlay.js";
import { EditorPane } from "./EditorPane.js";
import { formatItem, hashItem, readEditorDocument, type JsonMode } from "./editor-text.js";
import { useItemMutations } from "./use-item-mutations.js";

export function ItemEditor(props: {
  connectionId: string;
  table: string;
  item: Item;
  keys: readonly ItemKeySpec[];
}) {
  const mutations = useItemMutations(props.connectionId, props.table);
  const showSnackbar = useOverlayStore((state) => state.showSnackbar);
  const [mode, setMode] = useState<JsonMode>("plain");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(() => formatItem(props.item, "plain"));
  const [baseline, setBaseline] = useState(text);
  const [hash, setHash] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issues, setIssues] = useState(
    () => readEditorDocument(text, "plain", options(props)).issues,
  );
  const dirty = text !== baseline;
  const blocking = issues.some((issue) => issue.severity !== "warning");
  const warning = issues.find((issue) => issue.severity === "warning");

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
    if (read.item === null || hash === null || text === baseline) {
      return;
    }
    const before = props.item;
    try {
      const result = await mutations.update.mutateAsync({
        key: extractKey(before, props.keys),
        item: read.item,
        expectedHash: hash,
      });
      const formatted = formatItem(result.item, mode);
      setText(formatted);
      setBaseline(formatted);
      setHash(result.hash);
      setNotice(
        result.weakConcurrency === true ? "Saved. The conflict check was best-effort." : null,
      );
      showSnackbar("Saved", () => {
        void mutations.undoEdit({
          key: extractKey(before, props.keys),
          previous: before,
          savedHash: result.hash,
        });
      });
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "The save failed.");
    }
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
            disabled={!dirty || blocking || hash === null}
            onClick={() => void save()}
          >
            Save
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => {
              setEditing(true);
            }}
          >
            Edit
          </Button>
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
        <p className="px-4 pb-2 text-sm" role="alert">
          {notice}
        </p>
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
    </div>
  );
}

function options(props: { item: Item; keys: readonly ItemKeySpec[] }) {
  return { keys: props.keys, original: props.item };
}
