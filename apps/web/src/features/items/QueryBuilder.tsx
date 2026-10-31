import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import type { QueryPreview } from "@dynamo-studio/shared";
import { useEffect } from "react";
import { queryAction, readHotkey } from "../../lib/hotkeys.js";
import { ShowRequest } from "./ShowRequest.js";
import { queryFormMessage, type QueryDraft, type QueryTarget } from "./query-form.js";

const SORT_OPS = ["=", "<", "<=", ">", ">=", "between", "begins_with"] as const;

export function QueryBuilder({
  targets,
  targetIndex,
  onTarget,
  draft,
  onDraft,
  onRun,
  preview,
  region,
  endpoint,
}: {
  targets: readonly QueryTarget[];
  targetIndex: number;
  onTarget: (index: number) => void;
  draft: QueryDraft;
  onDraft: (draft: QueryDraft) => void;
  onRun: () => void;
  preview: QueryPreview | undefined;
  region: string;
  endpoint: string;
}) {
  const target = targets[targetIndex] ?? targets[0];
  const message = target === undefined ? undefined : queryFormMessage(target, draft);
  const gsi = target?.kind === "gsi";

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (queryAction(readHotkey(event, true)) === "run" && message === undefined) {
        event.preventDefault();
        onRun();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [message, onRun]);

  if (target === undefined) {
    return null;
  }

  return (
    <form
      className="grid gap-3 border-b border-outline px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (message === undefined) {
          onRun();
        }
      }}
    >
      <div className="flex flex-wrap items-start gap-2">
        <TextField
          select
          size="small"
          label="Target"
          value={String(targetIndex)}
          onChange={(event) => {
            onTarget(Number(event.target.value));
          }}
        >
          {targets.map((item, index) => (
            <MenuItem key={item.label} value={String(index)}>
              {item.kind === "table" ? "Table" : item.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label={target.partition.name}
          value={draft.partition}
          error={draft.partition.length === 0}
          helperText={
            draft.partition.length === 0 ? message : `${target.partition.type} partition key`
          }
          onChange={(event) => {
            onDraft({ ...draft, partition: event.target.value });
          }}
        />
        {target.partition.type === "B" || target.sort?.type === "B" ? (
          <TextField
            select
            size="small"
            label="Binary"
            value={draft.binaryEncoding}
            onChange={(event) => {
              const binaryEncoding = event.target.value === "hex" ? "hex" : "base64";
              onDraft({ ...draft, binaryEncoding });
            }}
          >
            <MenuItem value="base64">Base64</MenuItem>
            <MenuItem value="hex">Hex</MenuItem>
          </TextField>
        ) : null}
      </div>
      {target.sort === undefined ? null : (
        <div className="flex flex-wrap items-start gap-2">
          <FormControlLabel
            control={
              <Checkbox
                checked={draft.useSort}
                onChange={(event) => {
                  onDraft({ ...draft, useSort: event.target.checked });
                }}
              />
            }
            label={`Sort key ${target.sort.name}`}
          />
          {draft.useSort ? (
            <>
              <TextField
                select
                size="small"
                label="Operator"
                value={draft.sortOp}
                onChange={(event) => {
                  const sortOp = SORT_OPS.find((op) => op === event.target.value) ?? "=";
                  onDraft({ ...draft, sortOp });
                }}
              >
                {SORT_OPS.map((op) => (
                  <MenuItem key={op} value={op}>
                    {op}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Value"
                value={draft.sort}
                onChange={(event) => {
                  onDraft({ ...draft, sort: event.target.value });
                }}
              />
              {draft.sortOp === "between" ? (
                <TextField
                  size="small"
                  label="And value"
                  value={draft.sortTo}
                  onChange={(event) => {
                    onDraft({ ...draft, sortTo: event.target.value });
                  }}
                />
              ) : null}
            </>
          ) : null}
        </div>
      )}
      {message !== undefined && draft.partition.length > 0 ? (
        <p className="text-sm text-error">{message}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <TextField
          select
          size="small"
          label="Sort order"
          value={draft.scanForward ? "asc" : "desc"}
          onChange={(event) => {
            onDraft({ ...draft, scanForward: event.target.value !== "desc" });
          }}
        >
          <MenuItem value="asc">Ascending</MenuItem>
          <MenuItem value="desc">Descending</MenuItem>
        </TextField>
        <Tooltip
          title={gsi ? "Consistent read is not available on a global secondary index." : ""}
          disableHoverListener={!gsi}
        >
          <span>
            <FormControlLabel
              control={
                <Checkbox
                  checked={draft.consistentRead && !gsi}
                  disabled={gsi}
                  onChange={(event) => {
                    onDraft({ ...draft, consistentRead: event.target.checked });
                  }}
                />
              }
              label="Consistent read"
            />
          </span>
        </Tooltip>
        <TextField
          size="small"
          label="Projection"
          placeholder="All attributes"
          value={draft.projection.join(", ")}
          onChange={(event) => {
            const projection = event.target.value
              .split(",")
              .map((name) => name.trim())
              .filter((name) => name.length > 0);
            onDraft({ ...draft, projection });
          }}
        />
        <Button type="submit" variant="contained" disabled={message !== undefined}>
          Run query
        </Button>
      </div>
      <ShowRequest preview={preview} region={region} endpoint={endpoint} />
    </form>
  );
}
