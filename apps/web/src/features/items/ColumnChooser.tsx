import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import { useState } from "react";

export function ColumnChooser({
  names,
  hidden,
  capped,
  onToggle,
  onReset,
  onReveal,
}: {
  names: readonly string[];
  hidden: readonly string[];
  capped: number;
  onToggle: (name: string, visible: boolean) => void;
  onReset: () => void;
  onReveal: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = names.filter((name) => needle.length === 0 || name.toLowerCase().includes(needle));
  return (
    <>
      <Button
        onClick={(event) => {
          setAnchor(event.currentTarget);
        }}
      >
        Columns
      </Button>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <div className="flex w-72 flex-col gap-2 p-3">
          <TextField
            label="Find a column"
            size="small"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <div className="max-h-64 overflow-auto">
            {shown.map((name) => (
              <label key={name} className="flex items-center gap-1 text-sm">
                <Checkbox
                  size="small"
                  checked={!hidden.includes(name)}
                  onChange={(event) => {
                    onToggle(name, event.target.checked);
                  }}
                  slotProps={{ input: { "aria-label": `Show ${name}` } }}
                />
                <span className="truncate">{name}</span>
              </label>
            ))}
          </div>
          {capped > 0 ? (
            <Button
              onClick={() => {
                onReveal();
              }}
            >
              Show more columns
            </Button>
          ) : null}
          <Button
            onClick={() => {
              onReset();
            }}
          >
            Reset
          </Button>
        </div>
      </Popover>
    </>
  );
}
