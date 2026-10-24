import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import {
  FILTER_LIMIT,
  type AttributeValue,
  type Filter,
  type FilterOp,
} from "@dynamo-studio/shared";
import {
  TYPE_CODES,
  compileFilter,
  operatorsFor,
  valueKind,
  type ValueKind,
} from "./filter-ops.js";

export function FilterBar({
  columns,
  sample,
  filters,
  joiner,
  onChange,
}: {
  columns: readonly string[];
  sample: Record<string, AttributeValue> | undefined;
  filters: readonly Filter[];
  joiner: "and" | "or";
  onChange: (filters: Filter[], joiner: "and" | "or") => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [attribute, setAttribute] = useState("");
  const [op, setOp] = useState<FilterOp>("=");
  const [raw, setRaw] = useState("");
  const [raw2, setRaw2] = useState("");
  const [message, setMessage] = useState("");
  const kind = valueKind(sample?.[attribute]);
  const ops = operatorsFor(kind);

  function begin(index: number | null): void {
    const current = index === null ? undefined : filters[index];
    setEditing(index);
    setAttribute(current?.attribute ?? "");
    setOp(current?.op ?? "=");
    setRaw(shown(current?.value) || listShown(current?.values));
    setRaw2(shown(current?.value2));
    setMessage("");
    setOpen(true);
  }

  function apply(): void {
    const selected = ops.includes(op) ? op : (ops[0] ?? "=");
    const compiled = compileFilter({ attribute, op: selected, kind, raw, raw2 });
    if (!compiled.ok) {
      setMessage(compiled.message);
      return;
    }
    const next = [...filters];
    if (editing === null) {
      next.push(compiled.filter);
    } else {
      next[editing] = compiled.filter;
    }
    onChange(next, joiner);
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.length > 1 ? (
        <TextField
          select
          size="small"
          label="Match"
          value={joiner}
          onChange={(event) => {
            const next = event.target.value === "or" ? "or" : "and";
            onChange([...filters], next);
          }}
        >
          <MenuItem value="and">AND</MenuItem>
          <MenuItem value="or">OR</MenuItem>
        </TextField>
      ) : null}
      {filters.map((filter, index) => (
        <Chip
          key={`${filter.attribute}-${filter.op}-${String(index)}`}
          label={chipLabel(filter)}
          onClick={() => {
            begin(index);
          }}
          onDelete={() => {
            onChange(
              filters.filter((_item, itemIndex) => itemIndex !== index),
              joiner,
            );
          }}
        />
      ))}
      {filters.length > 0 ? (
        <Button
          onClick={() => {
            onChange([], "and");
          }}
        >
          Clear all
        </Button>
      ) : null}
      <Button
        disabled={filters.length >= FILTER_LIMIT && editing === null}
        onClick={() => {
          begin(null);
        }}
      >
        Add filter
      </Button>
      {open ? (
        <div className="flex w-full flex-wrap items-start gap-2">
          <TextField
            label="Attribute"
            size="small"
            value={attribute}
            onChange={(event) => {
              setAttribute(event.target.value);
            }}
            slotProps={{ htmlInput: { list: "scan-attributes" } }}
          />
          <datalist id="scan-attributes">
            {columns.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <TextField
            select
            size="small"
            label="Operator"
            value={ops.includes(op) ? op : (ops[0] ?? "=")}
            onChange={(event) => {
              setOp(event.target.value as FilterOp);
            }}
          >
            {ops.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          {op === "exists" || op === "not_exists" ? null : op === "type_is" ? (
            <TextField
              select
              size="small"
              label="Type"
              value={raw}
              onChange={(event) => {
                setRaw(event.target.value);
              }}
            >
              {TYPE_CODES.map((code) => (
                <MenuItem key={code} value={code}>
                  {code}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Value"
              size="small"
              value={raw}
              onChange={(event) => {
                setRaw(event.target.value);
              }}
            />
          )}
          {op === "between" ? (
            <TextField
              label="And value"
              size="small"
              value={raw2}
              onChange={(event) => {
                setRaw2(event.target.value);
              }}
            />
          ) : null}
          <Button variant="contained" onClick={apply}>
            Apply filter
          </Button>
          {message.length > 0 ? <p className="text-sm text-error">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function shown(value: AttributeValue | undefined): string {
  if (value === undefined) {
    return "";
  }
  if ("S" in value) {
    return value.S;
  }
  if ("N" in value) {
    return value.N;
  }
  if ("BOOL" in value) {
    return value.BOOL ? "true" : "false";
  }
  if ("B" in value) {
    return value.B;
  }
  return "";
}

function listShown(values: readonly AttributeValue[] | undefined): string {
  return values?.map((value) => shown(value)).join(", ") ?? "";
}

function chipLabel(filter: Filter): string {
  if (filter.op === "exists" || filter.op === "not_exists") {
    return `${filter.attribute} ${filter.op}`;
  }
  if (filter.op === "between") {
    return `${filter.attribute} between ${shown(filter.value)} and ${shown(filter.value2)}`;
  }
  if (filter.op === "in") {
    return `${filter.attribute} in ${listShown(filter.values)}`;
  }
  return `${filter.attribute} ${filter.op} ${shown(filter.value)}`;
}

export type { ValueKind };
