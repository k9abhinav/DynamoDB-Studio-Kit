import { describe, expect, it } from "vitest";
import { MAX_IMPORT_BYTES } from "../limits.js";
import {
  ConfirmNameBody,
  ExportRequest,
  ExportSummary,
  ImportOptions,
  ImportPreviewResponse,
  ImportProgressEvent,
} from "./transfer.js";

describe("transfer schemas", () => {
  it("defaults export to plain NDJSON and rejects a view cursor", () => {
    expect(ExportRequest.parse({ scope: "all" })).toEqual({
      format: "ndjson",
      typed: false,
      scope: "all",
    });
    expect(ExportRequest.safeParse({ scope: { scan: { cursor: "page-2" } } }).success).toBe(false);
    expect(
      ExportRequest.safeParse({
        scope: { query: { key: { pk: { name: "id", value: { S: "a" } } }, cursor: "page-2" } },
      }).success,
    ).toBe(false);
    expect(ExportRequest.safeParse({ scope: "page", format: "ndjson" }).success).toBe(false);
    expect(ExportRequest.safeParse({ scope: "all", region: "us-east-1" }).success).toBe(false);
  });

  it("requires CSV mapping and rejects it for JSON", () => {
    expect(ImportOptions.parse({ format: "ndjson" })).toEqual({
      format: "ndjson",
      mode: "put",
      dryRun: false,
    });
    expect(ImportOptions.safeParse({ format: "csv" }).success).toBe(false);
    expect(
      ImportOptions.safeParse({
        format: "json",
        mapping: { columns: [{ name: "id", type: "S" }] },
      }).success,
    ).toBe(false);
    expect(
      ImportOptions.parse({
        format: "csv",
        mode: "skip-existing",
        mapping: {
          columns: [
            { name: "id", type: "S" },
            { name: "qty", type: "N" },
          ],
        },
      }).mapping?.columns,
    ).toEqual([
      { name: "id", type: "S" },
      { name: "qty", type: "N" },
    ]);
  });

  it("requires a confirmation string and a duplicate count on import events", () => {
    expect(ConfirmNameBody.safeParse({ confirm: "" }).success).toBe(false);
    expect(ConfirmNameBody.parse({ confirm: "orders" }).confirm).toBe("orders");
    expect(MAX_IMPORT_BYTES).toBe(512 * 1024 * 1024);
    const counts = { processed: 2, written: 1, skipped: 1, failed: 0, duplicates: 3 };
    expect(ImportProgressEvent.parse({ type: "progress", ...counts })).toEqual({
      type: "progress",
      ...counts,
    });
    expect(
      ImportProgressEvent.safeParse({ type: "done", ...counts, errorsReportId: "short" }).success,
    ).toBe(false);
    expect(
      ImportPreviewResponse.parse({
        detectedFormat: "csv",
        sample: [{ id: { S: "a" } }],
        warnings: ["Nested values become JSON strings."],
      }).sample,
    ).toHaveLength(1);
    expect(ExportSummary.parse({ __summary: { items: 10, bytes: 20 } }).__summary.items).toBe(10);
  });
});
