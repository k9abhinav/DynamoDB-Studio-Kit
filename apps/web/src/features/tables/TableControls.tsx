import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import {
  TableDescription,
  UpdateTableBody,
  type TableDescription as TableInfo,
} from "@dynamo-studio/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";
import { api } from "../../lib/api.js";
import { tableKeys } from "../../lib/query-keys.js";

export function TableControls({
  connectionId,
  description,
  readOnly,
}: {
  connectionId: string;
  description: TableInfo;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [ttlAttribute, setTtlAttribute] = useState(description.ttl.attribute ?? "");
  const [rcu, setRcu] = useState(
    String(description.billing.mode === "PROVISIONED" ? description.billing.rcu : 1),
  );
  const [wcu, setWcu] = useState(
    String(description.billing.mode === "PROVISIONED" ? description.billing.wcu : 1),
  );
  const [indexName, setIndexName] = useState("");
  const [indexKey, setIndexKey] = useState("");
  const [deleteName, setDeleteName] = useState<string | undefined>();
  const busy = description.gsis.find((index) => index.status !== "ACTIVE");

  async function save(body: unknown) {
    setPending(true);
    setError(undefined);
    try {
      const parsed = UpdateTableBody.parse(body);
      await api(
        `/api/v1/connections/${encodeURIComponent(connectionId)}/tables/${encodeURIComponent(description.name)}`,
        { method: "PATCH", body: parsed, schema: TableDescription },
      );
      await queryClient.invalidateQueries({
        queryKey: tableKeys.detail(connectionId, description.name),
      });
      await queryClient.invalidateQueries({ queryKey: tableKeys.list(connectionId) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't update the table.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error === undefined ? null : <p className="text-sm text-error">{error}</p>}
      {busy === undefined ? null : (
        <p className="text-sm">
          Wait until {busy.name} is ACTIVE. DynamoDB changes one index at a time.
          {busy.status === "CREATING" ? " This index is still backfilling." : ""}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          select
          label="Billing"
          size="small"
          disabled={readOnly || pending || busy !== undefined}
          value={description.billing.mode}
          onChange={(event) => {
            const mode = event.target.value === "PROVISIONED" ? "PROVISIONED" : "PAY_PER_REQUEST";
            void save(
              mode === "PAY_PER_REQUEST"
                ? { billing: { mode } }
                : { billing: { mode, rcu: Number(rcu), wcu: Number(wcu) } },
            );
          }}
        >
          <MenuItem value="PAY_PER_REQUEST">On-demand</MenuItem>
          <MenuItem value="PROVISIONED">Provisioned</MenuItem>
        </TextField>
        {description.billing.mode === "PROVISIONED" ? (
          <>
            <TextField
              label="Read capacity"
              size="small"
              value={rcu}
              disabled={readOnly || pending}
              onChange={(event) => {
                setRcu(event.target.value);
              }}
            />
            <TextField
              label="Write capacity"
              size="small"
              value={wcu}
              disabled={readOnly || pending}
              onChange={(event) => {
                setWcu(event.target.value);
              }}
            />
            <Button
              disabled={readOnly || pending}
              onClick={() => {
                void save({ billing: { mode: "PROVISIONED", rcu: Number(rcu), wcu: Number(wcu) } });
              }}
            >
              Save capacity
            </Button>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="TTL attribute"
          size="small"
          value={ttlAttribute}
          disabled={readOnly || pending}
          helperText="TTL deletes items after the epoch-seconds time in this attribute. Deletion can take up to 48 hours."
          onChange={(event) => {
            setTtlAttribute(event.target.value);
          }}
        />
        <Switch
          checked={description.ttl.enabled}
          disabled={readOnly || pending || ttlAttribute.trim().length === 0}
          slotProps={{ input: { "aria-label": "TTL" } }}
          onChange={(_event, enabled) => {
            void save({ ttl: { enabled, attribute: ttlAttribute.trim() } });
          }}
        />
      </div>
      <FormControlLabel
        label="Deletion protection"
        control={
          <Switch
            checked={description.deletionProtection}
            disabled={readOnly || pending}
            onChange={(_event, deletionProtection) => {
              void save({ deletionProtection });
            }}
          />
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="New index name"
          size="small"
          value={indexName}
          disabled={readOnly || pending || busy !== undefined}
          onChange={(event) => {
            setIndexName(event.target.value);
          }}
        />
        <TextField
          label="New index partition key"
          size="small"
          value={indexKey}
          disabled={readOnly || pending || busy !== undefined}
          onChange={(event) => {
            setIndexKey(event.target.value);
          }}
        />
        <Button
          disabled={
            readOnly ||
            pending ||
            busy !== undefined ||
            indexName.trim().length === 0 ||
            indexKey.trim().length === 0
          }
          onClick={() => {
            void save({
              gsiCreate: {
                name: indexName.trim(),
                partitionKey: { name: indexKey.trim(), type: "S" },
                projection: { type: "KEYS_ONLY" },
              },
            });
          }}
        >
          Add index
        </Button>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {description.gsis.map((index) => (
          <li key={index.name} className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm">{index.name}</span>
            <Button
              color="error"
              disabled={readOnly || pending || busy !== undefined}
              onClick={() => {
                setDeleteName(index.name);
              }}
            >
              Delete {index.name}
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={deleteName !== undefined}
        title="Delete index"
        body="This removes the index. Type its name to confirm."
        confirmLabel="Delete index"
        {...(deleteName === undefined ? {} : { typedName: deleteName })}
        onClose={() => {
          setDeleteName(undefined);
        }}
        onConfirm={() => {
          const name = deleteName;
          setDeleteName(undefined);
          if (name !== undefined) {
            void save({ gsiDelete: name });
          }
        }}
      />
    </div>
  );
}
