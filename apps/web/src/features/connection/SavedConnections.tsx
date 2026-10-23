import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import {
  CreateConnectionResponse,
  EnvTag,
  PatchProfileBody,
  ProfileList,
  ProfileSummary,
  interpretEndpoint,
  type ProfileSummaryBody,
} from "@dynamo-studio/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { envDotClass, envLabel, type EnvName } from "../../components/EnvChip.js";
import { api, ApiError } from "../../lib/api.js";
import { errorCopy } from "../../lib/error-copy.js";
import { relativeTime } from "../../lib/relative-time.js";

export function SavedConnections({ onConnected }: { onConnected: (connectionId: string) => void }) {
  const queryClient = useQueryClient();
  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: ({ signal }) => api("/api/v1/profiles", { signal, schema: ProfileList }),
  });
  const [menu, setMenu] = useState<{ anchor: HTMLElement; profile: ProfileSummaryBody } | null>(
    null,
  );
  const [editing, setEditing] = useState<ProfileSummaryBody | null>(null);
  const [deleting, setDeleting] = useState<ProfileSummaryBody | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function connect(profile: ProfileSummaryBody) {
    setActionError(null);
    try {
      const created = await api(`/api/v1/profiles/${encodeURIComponent(profile.id)}/connect`, {
        method: "POST",
        schema: CreateConnectionResponse,
      });
      onConnected(created.connectionId);
    } catch (error) {
      setActionError(messageFor(error, profile.endpoint));
    }
  }

  async function remove(profile: ProfileSummaryBody) {
    await api(`/api/v1/profiles/${encodeURIComponent(profile.id)}`, { method: "DELETE" });
    setDeleting(null);
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
  }

  if (profiles.isPending) {
    return null;
  }
  if (profiles.isError) {
    return <Alert severity="error">Couldn't load saved connections.</Alert>;
  }
  if (profiles.data.length === 0 && actionError === null) {
    return null;
  }

  return (
    <section className="w-full max-w-[480px]" aria-label="Recent">
      <h2 className="mb-2 text-sm font-medium">Recent</h2>
      {actionError === null ? null : (
        <Alert className="mb-3" severity="error">
          {actionError}
        </Alert>
      )}
      <ul className="m-0 list-none p-0">
        {profiles.data.map((profile) => (
          <li key={profile.id} className="flex h-12 items-center gap-3 border-b border-outline">
            <span
              className={`size-2 shrink-0 rounded-full ${envDotClass(profile.env)}`}
              aria-label={envLabel(profile.env)}
            />
            <span className="truncate text-sm">{profile.name}</span>
            <span className="truncate text-sm text-text-secondary">{profileLocation(profile)}</span>
            <span className="ml-auto shrink-0 text-sm text-text-secondary">
              {relativeTime(profile.lastUsedAt)}
            </span>
            <IconButton
              aria-label={`Actions for ${profile.name}`}
              aria-haspopup="menu"
              onClick={(event) => {
                setMenu({ anchor: event.currentTarget, profile });
              }}
            >
              <MoreVertOutlined />
            </IconButton>
          </li>
        ))}
      </ul>
      <Menu
        anchorEl={menu?.anchor ?? null}
        open={menu !== null}
        onClose={() => {
          setMenu(null);
        }}
      >
        <MenuItem
          onClick={() => {
            const profile = menu?.profile;
            setMenu(null);
            if (profile !== undefined) {
              void connect(profile);
            }
          }}
        >
          Connect
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEditing(menu?.profile ?? null);
            setMenu(null);
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleting(menu?.profile ?? null);
            setMenu(null);
          }}
        >
          Delete
        </MenuItem>
      </Menu>
      <EditDialog
        profile={editing}
        onClose={() => {
          setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          void queryClient.invalidateQueries({ queryKey: ["profiles"] });
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={deleting === null ? "Delete connection" : `Delete ${deleting.name}?`}
        body="This removes the saved connection from this computer."
        confirmLabel="Delete"
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting !== null) {
            void remove(deleting);
          }
        }}
      />
    </section>
  );
}

function EditDialog({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfileSummaryBody | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={profile !== null} onClose={onClose} aria-labelledby="edit-connection-title">
      {profile === null ? null : <EditForm profile={profile} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function EditForm({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfileSummaryBody;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [endpoint, setEndpoint] = useState(profile.endpoint);
  const [region, setRegion] = useState(profile.region);
  const [env, setEnv] = useState<EnvName>(profile.env);
  const [readOnly, setReadOnly] = useState(profile.readOnly);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const interpreted = interpretEndpoint(endpoint);
    if (interpreted.error !== undefined) {
      setError(interpreted.error);
      return;
    }
    const body = PatchProfileBody.parse({
      name: name.trim(),
      endpoint: interpreted.endpoint ?? "",
      region: region.trim(),
      env,
      readOnly,
    });
    setSaving(true);
    setError(null);
    try {
      await api(`/api/v1/profiles/${encodeURIComponent(profile.id)}`, {
        method: "PATCH",
        body,
        schema: ProfileSummary,
      });
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <>
      <DialogTitle id="edit-connection-title">Edit connection</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <TextField
          className="mt-1"
          label="Name"
          value={name}
          fullWidth
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <TextField
          label="Endpoint"
          value={endpoint}
          fullWidth
          onChange={(event) => {
            setEndpoint(event.target.value);
          }}
        />
        <TextField
          label="Region"
          value={region}
          fullWidth
          onChange={(event) => {
            setRegion(event.target.value);
          }}
        />
        <TextField
          select
          label="Environment"
          value={env}
          fullWidth
          onChange={(event) => {
            const parsed = EnvTag.safeParse(event.target.value);
            if (parsed.success) {
              setEnv(parsed.data);
            }
          }}
        >
          <MenuItem value="local">Local</MenuItem>
          <MenuItem value="dev">Dev</MenuItem>
          <MenuItem value="staging">Staging</MenuItem>
          <MenuItem value="production">Production</MenuItem>
        </TextField>
        <FormControlLabel
          control={
            <Switch
              checked={readOnly}
              onChange={(event) => {
                setReadOnly(event.target.checked);
              }}
            />
          }
          label="Read only"
        />
        {error === null ? null : <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={saving || name.trim().length === 0 || region.trim().length === 0}
          onClick={() => {
            void save();
          }}
        >
          Save
        </Button>
      </DialogActions>
    </>
  );
}

function profileLocation(profile: ProfileSummaryBody): string {
  if (profile.endpoint.length === 0) {
    return profile.region;
  }
  try {
    return new URL(profile.endpoint).host;
  } catch {
    return profile.endpoint;
  }
}

function messageFor(error: unknown, endpoint: string): string {
  if (error instanceof ApiError) {
    return errorCopy(error, endpoint.length === 0 ? undefined : endpoint);
  }
  return "Something went wrong.";
}
