import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { formatPlain, toPlainItem, type Item } from "@dynamo-studio/shared";

export function ConflictDialog(props: {
  open: boolean;
  yours: Item | null;
  latest: Item | null;
  onReload: () => void;
  onOverwrite: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} aria-labelledby="conflict-title">
      <DialogTitle id="conflict-title">This item changed since you opened it</DialogTitle>
      <DialogContent>
        <p className="pb-3 text-sm text-text-secondary">
          The conflict check is best-effort. Another write may have added an attribute that this
          check did not see.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <section>
            <h3 className="pb-1 text-sm font-medium">Your edit</h3>
            <pre className="overflow-auto font-mono text-xs">{format(props.yours)}</pre>
          </section>
          <section>
            <h3 className="pb-1 text-sm font-medium">Latest</h3>
            <pre className="overflow-auto font-mono text-xs">{format(props.latest)}</pre>
          </section>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button onClick={props.onReload}>Reload latest</Button>
        <Button variant="contained" onClick={props.onOverwrite}>
          Overwrite
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function format(item: Item | null): string {
  if (item === null) {
    return "Loading…";
  }
  return formatPlain(toPlainItem(item));
}
