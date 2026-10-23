import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { EmptyState } from "../../components/EmptyState.js";
import { EnvChip } from "../../components/EnvChip.js";
import { ErrorState } from "../../components/ErrorState.js";
import { Skeletons } from "../../components/Skeletons.js";
import InboxOutlined from "@mui/icons-material/InboxOutlined";
import { useOverlayStore } from "../../stores/overlay.js";
import { TokenTables } from "./TokenTable.js";

export function DesignGallery() {
  const [confirm, setConfirm] = useState(false);
  const showSnackbar = useOverlayStore((state) => state.showSnackbar);
  return (
    <main className="mx-auto grid max-w-5xl gap-8 bg-bg p-6 text-text">
      <h1 className="text-[22px] leading-7">Design gallery</h1>
      <section className="flex flex-wrap gap-3">
        <Button variant="contained">Save</Button>
        <Button variant="outlined">Cancel</Button>
        <Button variant="text">More</Button>
        <Button variant="contained" disabled>
          Disabled
        </Button>
        <Button variant="contained" loading>
          Loading
        </Button>
      </section>
      <Card data-testid="layer-probe" className="rounded-none p-4">
        Layer probe
      </Card>
      <TextField label="Table name" defaultValue="orders" />
      <TextField select label="Region" defaultValue="us-east-1">
        <MenuItem value="us-east-1">us-east-1</MenuItem>
        <MenuItem value="eu-west-1">eu-west-1</MenuItem>
      </TextField>
      <div className="flex gap-2">
        <Chip label="Filter" variant="outlined" onDelete={() => undefined} />
        <EnvChip env="staging" />
      </div>
      <Tabs value="items" aria-label="Sample tabs">
        <Tab value="items" label="Items" />
        <Tab value="overview" label="Overview" />
      </Tabs>
      <Tooltip title="Why this is disabled">
        <span>
          <Button disabled>Read-only</Button>
        </span>
      </Tooltip>
      <Skeletons rows={2} />
      <EmptyState
        icon={<InboxOutlined className="text-[48px]" />}
        title="Nothing here"
        help="This is the empty state."
        action={<Button variant="contained">Add item</Button>}
      />
      <ErrorState
        message="Couldn't reach the table."
        details="ResourceNotFoundException request id example"
        onRetry={() => undefined}
      />
      <div className="flex gap-3">
        <Button
          onClick={() => {
            showSnackbar("Item saved");
          }}
        >
          Show snackbar
        </Button>
        <Button
          onClick={() => {
            showSnackbar("Item deleted", () => undefined);
          }}
        >
          Show undo
        </Button>
        <Button
          color="error"
          onClick={() => {
            setConfirm(true);
          }}
        >
          Delete orders
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete orders?"
        body="This cannot be undone."
        confirmLabel="Delete orders"
        typedName="orders"
        onClose={() => {
          setConfirm(false);
        }}
        onConfirm={() => {
          setConfirm(false);
        }}
      />
      <TokenTables />
    </main>
  );
}
