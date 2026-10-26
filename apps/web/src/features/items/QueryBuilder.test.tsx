import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { QueryBuilder } from "./QueryBuilder.js";
import { emptyQueryDraft, type QueryDraft, type QueryTarget } from "./query-form.js";

const table: QueryTarget = {
  label: "Table",
  kind: "table",
  partition: { name: "userId", type: "S" },
  sort: { name: "createdAt", type: "S" },
};

const gsi: QueryTarget = {
  label: "status-createdAt-index",
  index: "status-createdAt-index",
  kind: "gsi",
  partition: { name: "status", type: "S" },
  sort: { name: "createdAt", type: "S" },
};

function Harness({ onRun }: { onRun: () => void }) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [draft, setDraft] = useState<QueryDraft>(emptyQueryDraft());
  return (
    <QueryBuilder
      targets={[table, gsi]}
      targetIndex={targetIndex}
      onTarget={setTargetIndex}
      draft={draft}
      onDraft={setDraft}
      onRun={onRun}
      preview={{
        TableName: "orders",
        KeyConditionExpression: "#n0 = :v0",
        ExpressionAttributeNames: { "#n0": "userId" },
        ExpressionAttributeValues: { ":v0": { S: "user-0001" } },
        ScanIndexForward: false,
        Limit: 25,
      }}
      region="us-east-1"
      endpoint="http://127.0.0.1:8000"
    />
  );
}

describe("QueryBuilder", () => {
  it("disables Run until the partition key is filled and shows the server request", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(
      <AppProviders>
        <Harness onRun={onRun} />
      </AppProviders>,
    );
    expect(screen.getByRole("button", { name: "Run query" })).toBeDisabled();
    expect(
      screen.getByText("Query needs a partition key value. Use Scan to browse without one."),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("userId"), "user-0001");
    expect(screen.getByRole("button", { name: "Run query" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Show request" }));
    expect(screen.getByText(/#n0 = :v0/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "AWS CLI" }));
    const cli = screen.getByText(/aws dynamodb query/);
    expect(cli).toBeInTheDocument();
    expect(cli.textContent).not.toMatch(/secret|access-key/iu);
    await user.click(screen.getByRole("button", { name: "Run query" }));
    expect(onRun).toHaveBeenCalledOnce();
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onRun).toHaveBeenCalledTimes(2);
  });

  it("disables consistent read on a global secondary index", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <Harness onRun={vi.fn()} />
      </AppProviders>,
    );
    await user.click(screen.getByLabelText("Target"));
    await user.click(screen.getByRole("option", { name: "status-createdAt-index" }));
    expect(screen.getByRole("checkbox", { name: "Consistent read" })).toBeDisabled();
    await user.hover(
      screen.getByRole("checkbox", { name: "Consistent read" }).parentElement ?? document.body,
    );
    expect(
      await screen.findByText("Consistent read is not available on a global secondary index."),
    ).toBeInTheDocument();
  });
});
