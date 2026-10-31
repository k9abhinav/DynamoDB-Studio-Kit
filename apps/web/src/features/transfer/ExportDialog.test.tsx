import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/providers.js";
import { apiStream } from "../../lib/api.js";
import { ExportDialog } from "./ExportDialog.js";
import { ProgressToast } from "./ProgressToast.js";
import { useTransferStore } from "./store.js";

vi.mock("../../lib/api.js", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api.js")>("../../lib/api.js");
  return { ...actual, apiStream: vi.fn() };
});

const mockedStream = vi.mocked(apiStream);

function renderExport(endpoint = "http://127.0.0.1:8000") {
  render(
    <MemoryRouter>
      <AppProviders>
        <ExportDialog
          open
          connectionId="local"
          table="notes"
          endpoint={endpoint}
          view={{ scan: { filterJoiner: "and" } }}
          onClose={() => undefined}
        />
        <ProgressToast />
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("ExportDialog", () => {
  beforeEach(() => {
    mockedStream.mockReset();
    useTransferStore.setState({ job: null });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("exports the current view from the start and can cancel", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    let signal: AbortSignal | undefined;
    mockedStream.mockImplementation((_path, init) => {
      signal = init.signal;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"id":"1"}\n'));
          controller.close();
        },
      });
      return Promise.resolve(new Response(stream));
    });
    renderExport();
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(mockedStream.mock.calls[0]?.[0]).toBe("/api/v1/connections/local/tables/notes/export");
    expect(mockedStream.mock.calls[0]?.[1].json).toEqual({
      format: "ndjson",
      typed: false,
      scope: { scan: { filterJoiner: "and", limit: 50 } },
    });
    expect(signal?.aborted).toBe(false);
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("cancels an export that is still reading", async () => {
    const user = userEvent.setup();
    mockedStream.mockImplementation((_path, init) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    renderExport();
    await user.click(screen.getByRole("button", { name: "Export" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useTransferStore.getState().job?.status).toBe("canceled");
  });

  it("asks for the table name before a full export outside local", async () => {
    const user = userEvent.setup();
    renderExport("https://dynamodb.us-east-1.amazonaws.com");
    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(screen.getByRole("option", { name: "Entire table" }));
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByText("This reads every item and can be expensive.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Type notes to export"), "notes");
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });
});
