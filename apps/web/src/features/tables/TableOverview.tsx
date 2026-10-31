import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import type { TableDescription } from "@dynamo-studio/shared";
import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton.js";
import { TransferMenu } from "../transfer/TransferMenu.js";
import { TableControls } from "./TableControls.js";
import { IndexList } from "./IndexList.js";
import { formatBytes, formatCreatedAt, tableStatusLabel, tableStatusTone } from "./present.js";
import { TypeBadge } from "./TypeBadge.js";

export function TableOverview({
  description,
  connectionId,
  readOnly = false,
}: {
  description: TableDescription;
  connectionId?: string;
  readOnly?: boolean;
}) {
  const tone = tableStatusTone(description.status);
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      <Card title="Summary">
        <Chip
          size="small"
          color={tone === "warning" ? "warning" : tone === "progress" ? "primary" : "default"}
          label={tableStatusLabel(description.status)}
        />
        <Row label="Created" value={formatCreatedAt(description.createdAt)} />
        <div className="mt-3 flex items-center gap-1">
          <span className="text-sm text-text-secondary">ARN</span>
          <span className="truncate font-mono text-sm">{description.arn}</span>
          <CopyButton value={description.arn} label="Copy ARN" />
        </div>
        <Row label="Deletion protection" value={description.deletionProtection ? "On" : "Off"} />
        <p className="mt-3 flex items-center gap-1 text-sm">
          About {description.itemCount.toLocaleString("en-US")} items,{" "}
          {formatBytes(description.sizeBytes)}
          <Tooltip title="Approximate. DynamoDB updates this count periodically.">
            <IconButton aria-label="About this count" size="small">
              <InfoOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </p>
      </Card>
      <Card title="Keys">
        {description.keySchema.map((key) => (
          <p key={key.keyType} className="mt-2 flex items-center gap-2 text-sm">
            <span>{key.keyType === "HASH" ? "Partition key" : "Sort key"}</span>
            <span className="font-mono">{key.name}</span>
            <TypeBadge type={key.type} />
          </p>
        ))}
      </Card>
      <Card title="Capacity">
        {description.billing.mode === "PAY_PER_REQUEST" ? (
          <p className="text-sm">On-demand</p>
        ) : (
          <p className="text-sm">
            Provisioned, {String(description.billing.rcu)} RCU, {String(description.billing.wcu)}{" "}
            WCU
          </p>
        )}
      </Card>
      <Card title="TTL">
        <p className="text-sm">
          {description.ttl.enabled ? `Enabled on ${description.ttl.attribute ?? ""}` : "Disabled"}
        </p>
      </Card>
      <Card title="Streams">
        <p className="text-sm">
          {description.stream.enabled
            ? `Enabled, ${description.stream.viewType ?? ""}`
            : "Disabled"}
        </p>
      </Card>
      {connectionId === undefined ? null : (
        <Card title="Settings">
          <TransferMenu
            connectionId={connectionId}
            table={description.name}
            readOnly={readOnly}
            itemCount={description.itemCount}
          />
          <TableControls
            connectionId={connectionId}
            description={description}
            readOnly={readOnly}
          />
        </Card>
      )}
      <Card title="Indexes">
        <h3 className="text-sm font-medium">Global secondary indexes</h3>
        <IndexList indexes={description.gsis} empty="No global secondary indexes." />
        <h3 className="mt-3 text-sm font-medium">Local secondary indexes</h3>
        <IndexList indexes={description.lsis} empty="No local secondary indexes." />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-outline bg-surface p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-3 text-sm">
      <span className="text-text-secondary">{label}</span> {value}
    </p>
  );
}
