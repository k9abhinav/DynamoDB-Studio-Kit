import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { apiStream } from "../../lib/api.js";
import { ImportWizard } from "./ImportWizard.js";
import { ProgressToast } from "./ProgressToast.js";
import { useTransferStore } from "./store.js";

vi.mock("../../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api.js")>("../../lib/api.js");
  return { ...actual, apiStream: vi.fn() };
});

const mockedStream = vi.mocked(apiStream);
const preview = {
  detectedFormat: "csv",
  sample: [{ id: { S: "1" } }],
  inferredColumns: [{ name: "id", type: "S" }],
  warnings: [],
};

function renderWizard() {
  render(
    <MemoryRouter>
      <AppProviders>
        <ImportWizard open connectionId="local" table="notes" onClose={() => undefined} />
        <ProgressToast />
      </AppProviders>
    </MemoryRouter>,
  );
}

async function chooseFile(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(
    screen.getByLabelText("Import file"),
    new File(["id\n1\n"], "notes.csv", { type: "text/csv" }),
  );
  await screen.findByText(/007 stays a string/);
}

describe("ImportWizard", () => {
  beforeEach(() => {
    mockedStream.mockReset();
    useTransferStore.setState({ job: null });
  });

  it("previews a CSV, keeps string columns, and warns before the tab closes", async () => {
    const user = userEvent.setup();
    mockedStream.mockImplementation((path) => {
      if (path.endsWith("/preview")) {
        return Promise.resolve(new Response(JSON.stringify(preview)));
      }
      return new Promise(() => undefined);
    });
    renderWizard();
    await chooseFile(user);
    expect(
      screen.getByText("Skip existing is slower. Each row is its own conditional write."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import" }));
    const form = mockedStream.mock.calls[1]?.[1].form;
    const raw = form instanceof FormData ? form.get("options") : null;
    if (typeof raw !== "string") {
      throw new Error("Import options were not sent.");
    }
    expect(JSON.parse(raw)).toMatchObject({
      format: "csv",
      mode: "put",
      dryRun: false,
      mapping: { columns: [{ name: "id", type: "S" }] },
    });
    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    expect(useTransferStore.getState().job?.kind).toBe("import");
  });

  it("offers the error report after a failed row", async () => {
    const user = userEvent.setup();
    const reportId = "aaaaaaaaaaaaaaaaaaaaaa";
    mockedStream.mockImplementation((path) => {
      if (path.endsWith("/preview")) {
        return Promise.resolve(new Response(JSON.stringify(preview)));
      }
      if (path.includes("/errors/")) {
        return Promise.resolve(new Response('{"row":2,"reason":"Missing key"}\n'));
      }
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `{"type":"done","processed":1,"written":0,"skipped":0,"failed":1,"duplicates":0,"errorsReportId":"${reportId}"}\n`,
            ),
          );
          controller.close();
        },
      });
      return Promise.resolve(new Response(stream));
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:report");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderWizard();
    await chooseFile(user);
    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(await screen.findByRole("button", { name: "Download error report" }));
    expect(mockedStream).toHaveBeenCalledWith(
      `/api/v1/connections/local/import/errors/${reportId}`,
      { method: "GET" },
    );
  });
});
