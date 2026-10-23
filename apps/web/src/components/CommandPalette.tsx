import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterLabels } from "../lib/tables.js";
import { useOverlayStore } from "../stores/overlay.js";

export function CommandPalette() {
  const open = useOverlayStore((state) => state.overlay === "palette");
  const close = useOverlayStore((state) => state.closeOverlay);
  const openOverlay = useOverlayStore((state) => state.openOverlay);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      field.current?.focus();
    }
  }, [open]);
  const labels = useMemo(() => filterLabels(["Keyboard shortcuts", "About"], query), [query]);
  const current = labels[active] ?? labels[0];

  return (
    <Dialog open={open} onClose={close} aria-labelledby="palette-title" fullWidth maxWidth="sm">
      <div className="p-4">
        <h2 id="palette-title" className="sr-only">
          Search
        </h2>
        <TextField
          inputRef={field}
          fullWidth
          label="Search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, labels.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter" && current !== undefined) {
              event.preventDefault();
              run(current);
            }
          }}
        />
        <ul role="listbox" aria-label="Commands" className="mt-3 m-0 list-none p-0">
          {labels.map((label) => (
            <li key={label}>
              <button
                type="button"
                role="option"
                aria-selected={label === current}
                className={`h-10 w-full rounded-lg px-3 text-left ${
                  label === current ? "bg-primary-container text-primary" : ""
                }`}
                onClick={() => {
                  run(label);
                }}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );

  function run(label: string) {
    close();
    setQuery("");
    if (label === "Keyboard shortcuts") {
      openOverlay("shortcuts");
      return;
    }
    if (label === "About") {
      openOverlay("about");
    }
  }
}
