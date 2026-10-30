import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import {
  TABLE_NAME_PATTERN,
  TableDescription,
  buildCreateTableRequest,
} from "@dynamo-studio/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../../lib/api.js";
import { tableKeys } from "../../lib/query-keys.js";
import { createBodyFromDraft, EMPTY_CREATE_DRAFT, type CreateDraft } from "./create-draft.js";

const STEPS = ["Keys", "Options", "Review"] as const;

export function CreateTableWizard({
  open,
  connectionId,
  onClose,
}: {
  open: boolean;
  connectionId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [showRequest, setShowRequest] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const name = draft.name.trim();
  const nameValid = TABLE_NAME_PATTERN.test(name);
  const availability = useQuery({
    queryKey: ["table-name", connectionId, name],
    enabled: open && nameValid,
    queryFn: async ({ signal }) => {
      try {
        await api(
          `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(name)}`,
          { signal, schema: TableDescription },
        );
        return "taken" as const;
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === "NOT_FOUND") {
          return "free" as const;
        }
        throw caught;
      }
    },
  });
  const body = safeBody(draft);
  const blocked =
    !nameValid ||
    draft.partitionName.trim().length === 0 ||
    availability.data === "taken" ||
    body === undefined;

  function close() {
    setStep(0);
    setDraft(EMPTY_CREATE_DRAFT);
    setShowRequest(false);
    setError(undefined);
    onClose();
  }

  async function create() {
    if (body === undefined) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await api(`/api/v1/connections/${encodeURIComponent(connectionId)}/tables`, {
        method: "POST",
        body,
        schema: TableDescription,
      });
      await queryClient.invalidateQueries({ queryKey: tableKeys.list(connectionId) });
      close();
      void navigate(`/c/${connectionId}/t/${encodeURIComponent(body.name)}/overview`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't create the table.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      aria-labelledby="create-table-title"
    >
      <DialogTitle id="create-table-title">Create table</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">
          Step {String(step + 1)} of 3: {STEPS[step]}
        </p>
        {error === undefined ? null : (
          <Alert severity="error" variant="outlined">
            {error}
          </Alert>
        )}
        {step === 0 ? (
          <KeysStep
            draft={draft}
            nameValid={nameValid}
            availability={availability.data}
            onChange={setDraft}
          />
        ) : null}
        {step === 1 ? <OptionsStep draft={draft} onChange={setDraft} /> : null}
        {step === 2 && body !== undefined ? (
          <ReviewStep
            draft={draft}
            request={
              showRequest ? JSON.stringify(buildCreateTableRequest(body), null, 2) : undefined
            }
            onToggle={() => {
              setShowRequest((current) => !current);
            }}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        {step > 0 ? (
          <Button
            onClick={() => {
              setStep((current) => current - 1);
            }}
          >
            Back
          </Button>
        ) : null}
        {step < 2 ? (
          <Button
            variant="contained"
            disabled={step === 0 && blocked}
            onClick={() => {
              setStep((current) => current + 1);
            }}
          >
            Next
          </Button>
        ) : (
          <Button variant="contained" disabled={blocked || pending} onClick={() => void create()}>
            Create
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function KeysStep({
  draft,
  nameValid,
  availability,
  onChange,
}: {
  draft: CreateDraft;
  nameValid: boolean;
  availability: "free" | "taken" | undefined;
  onChange: (draft: CreateDraft) => void;
}) {
  const nameHelp =
    draft.name.trim().length === 0
      ? "3–255 letters, numbers, dots, dashes, or underscores."
      : nameValid
        ? availability === "taken"
          ? "That table name is already in use."
          : availability === "free"
            ? "Name is available."
            : "Checking that name."
        : "Use 3–255 letters, numbers, dots, dashes, or underscores.";
  return (
    <>
      <TextField
        label="Table name"
        value={draft.name}
        error={draft.name.trim().length > 0 && (!nameValid || availability === "taken")}
        helperText={nameHelp}
        onChange={(event) => {
          onChange({ ...draft, name: event.target.value });
        }}
      />
      <div className="flex gap-3">
        <TextField
          className="flex-1"
          label="Partition key"
          value={draft.partitionName}
          onChange={(event) => {
            onChange({ ...draft, partitionName: event.target.value });
          }}
        />
        <TypeField
          label="Partition key type"
          value={draft.partitionType}
          onChange={(partitionType) => {
            onChange({ ...draft, partitionType });
          }}
        />
      </div>
      <div className="flex gap-3">
        <TextField
          className="flex-1"
          label="Sort key"
          value={draft.sortName}
          helperText="Optional"
          onChange={(event) => {
            onChange({ ...draft, sortName: event.target.value });
          }}
        />
        <TypeField
          label="Sort key type"
          value={draft.sortType}
          onChange={(sortType) => {
            onChange({ ...draft, sortType });
          }}
        />
      </div>
    </>
  );
}

function OptionsStep({
  draft,
  onChange,
}: {
  draft: CreateDraft;
  onChange: (draft: CreateDraft) => void;
}) {
  return (
    <>
      <TextField
        select
        label="Billing"
        value={draft.billingMode}
        onChange={(event) => {
          const billingMode =
            event.target.value === "PROVISIONED" ? "PROVISIONED" : "PAY_PER_REQUEST";
          onChange({ ...draft, billingMode });
        }}
      >
        <MenuItem value="PAY_PER_REQUEST">On-demand</MenuItem>
        <MenuItem value="PROVISIONED">Provisioned</MenuItem>
      </TextField>
      {draft.billingMode === "PROVISIONED" ? (
        <div className="flex gap-3">
          <TextField
            label="Read capacity"
            value={draft.rcu}
            onChange={(event) => {
              onChange({ ...draft, rcu: event.target.value });
            }}
          />
          <TextField
            label="Write capacity"
            value={draft.wcu}
            onChange={(event) => {
              onChange({ ...draft, wcu: event.target.value });
            }}
          />
        </div>
      ) : null}
      <TextField
        label="TTL attribute"
        value={draft.ttlAttribute}
        helperText="TTL deletes items after the epoch-seconds time in this attribute. Deletion can take up to 48 hours."
        onChange={(event) => {
          onChange({ ...draft, ttlAttribute: event.target.value });
        }}
      />
      <FormControlLabel
        label="Deletion protection"
        control={
          <Switch
            checked={draft.deletionProtection}
            onChange={(_event, deletionProtection) => {
              onChange({ ...draft, deletionProtection });
            }}
          />
        }
      />
      <TextField
        label="Index name"
        value={draft.gsiName}
        helperText="Optional. Leave blank to skip the index."
        onChange={(event) => {
          onChange({ ...draft, gsiName: event.target.value });
        }}
      />
      <TextField
        label="Index partition key"
        value={draft.gsiPartitionName}
        onChange={(event) => {
          onChange({ ...draft, gsiPartitionName: event.target.value });
        }}
      />
    </>
  );
}

function ReviewStep({
  draft,
  request,
  onToggle,
}: {
  draft: CreateDraft;
  request: string | undefined;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {draft.name} with partition key {draft.partitionName}
        {draft.sortName.trim().length === 0 ? "" : ` and sort key ${draft.sortName}`}.{" "}
        {draft.billingMode === "PAY_PER_REQUEST" ? "On-demand" : "Provisioned"} billing.
      </p>
      <Button onClick={onToggle}>{request === undefined ? "Show request" : "Hide request"}</Button>
      {request === undefined ? null : (
        <pre className="overflow-auto rounded-xl border border-outline bg-surface-variant p-3 font-mono text-xs">
          {request}
        </pre>
      )}
    </div>
  );
}

function TypeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "S" | "N" | "B";
  onChange: (value: "S" | "N" | "B") => void;
}) {
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        if (next === "S" || next === "N" || next === "B") {
          onChange(next);
        }
      }}
    >
      <MenuItem value="S">String</MenuItem>
      <MenuItem value="N">Number</MenuItem>
      <MenuItem value="B">Binary</MenuItem>
    </TextField>
  );
}

function safeBody(draft: CreateDraft) {
  try {
    return createBodyFromDraft(draft);
  } catch {
    return undefined;
  }
}
