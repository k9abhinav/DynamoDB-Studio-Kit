import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import type { QueryPreview } from "@dynamo-studio/shared";
import { useState } from "react";
import { awsQueryCommand, queryPreviewText } from "./query-form.js";

export function ShowRequest({
  preview,
  region,
  endpoint,
}: {
  preview: QueryPreview | undefined;
  region: string;
  endpoint: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"json" | "cli">("json");
  const text =
    preview === undefined
      ? ""
      : tab === "json"
        ? queryPreviewText(preview)
        : awsQueryCommand({ preview, region, endpoint });

  return (
    <div className="border-t border-outline">
      <Button
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        Show request
      </Button>
      {open ? (
        <div className="grid gap-2 px-3 pb-3">
          {preview === undefined ? (
            <p className="text-sm text-text-secondary">
              Run the query to see the request DynamoDB receives.
            </p>
          ) : (
            <>
              <Tabs
                value={tab}
                onChange={(_event, next: string) => {
                  if (next === "json" || next === "cli") {
                    setTab(next);
                  }
                }}
              >
                <Tab value="json" label="JSON" />
                <Tab value="cli" label="AWS CLI" />
              </Tabs>
              <pre className="overflow-auto rounded-lg border border-outline bg-surface-variant p-3 font-mono text-xs">
                {text}
              </pre>
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(text);
                }}
              >
                Copy request
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
