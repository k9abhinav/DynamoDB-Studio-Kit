import { z } from "zod";
import { MAX_IMPORT_BYTES } from "../limits.js";
import { Item } from "./attribute.js";
import { QueryRequest } from "./query.js";
import { ScanRequest } from "./scan.js";

export { MAX_IMPORT_BYTES };
export const MAX_EXPORT_ITEMS = 1_000_000;
export const IMPORT_PREVIEW_ROWS = 20;
export const IMPORT_BATCH_SIZE = 25;
export const SKIP_EXISTING_CONCURRENCY = 4;
export const CSV_COLUMN_LIMIT = 100;

export const ExportFormat = z.enum(["ndjson", "json", "csv"]);
export const ImportFormat = z.enum(["ndjson", "json", "csv"]);
export const ImportMode = z.enum(["put", "skip-existing"]);
export const CsvColumnType = z.enum(["S", "N", "BOOL", "JSON", "skip"]);

const attributeName = z.string().min(1).max(255);

function rejectCursor(cursor: string | undefined, ctx: z.RefinementCtx): void {
  if (cursor !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["cursor"],
      message: "Export starts from the beginning of the view.",
    });
  }
}

const ExportScan = ScanRequest.superRefine((body, ctx) => {
  rejectCursor(body.cursor, ctx);
});

const ExportQuery = QueryRequest.superRefine((body, ctx) => {
  rejectCursor(body.cursor, ctx);
});

export const ExportRequest = z.strictObject({
  format: ExportFormat.default("ndjson"),
  typed: z.boolean().default(false),
  scope: z.union([
    z.literal("all"),
    z.strictObject({ scan: ExportScan }),
    z.strictObject({ query: ExportQuery }),
  ]),
  maxItems: z.number().int().min(1).max(MAX_EXPORT_ITEMS).optional(),
});

export type ExportRequest = z.infer<typeof ExportRequest>;

export const CsvMapping = z.strictObject({
  header: z.boolean().default(true),
  delimiter: z.string().length(1).default(","),
  columns: z
    .array(
      z.strictObject({
        name: attributeName,
        type: CsvColumnType,
      }),
    )
    .min(1)
    .max(CSV_COLUMN_LIMIT),
});

export type CsvMapping = z.infer<typeof CsvMapping>;

export const ImportOptions = z
  .strictObject({
    format: ImportFormat,
    mode: ImportMode.default("put"),
    dryRun: z.boolean().default(false),
    mapping: CsvMapping.optional(),
  })
  .superRefine((body, ctx) => {
    if (body.format === "csv" && body.mapping === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["mapping"],
        message: "CSV import needs a column mapping.",
      });
    }
    if (body.format !== "csv" && body.mapping !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["mapping"],
        message: "Column mapping is only for CSV.",
      });
    }
  });

export type ImportOptions = z.infer<typeof ImportOptions>;

export const ConfirmNameBody = z.strictObject({
  confirm: z.string().min(1).max(255),
});

export type ConfirmNameBody = z.infer<typeof ConfirmNameBody>;

const InferredColumn = z.strictObject({
  name: attributeName,
  type: z.enum(["S", "N", "BOOL", "JSON"]),
});

export const ImportPreviewResponse = z.strictObject({
  detectedFormat: ImportFormat,
  sample: z.array(Item).max(IMPORT_PREVIEW_ROWS),
  inferredColumns: z.array(InferredColumn).max(CSV_COLUMN_LIMIT).optional(),
  warnings: z.array(z.string().min(1)),
});

export type ImportPreviewResponse = z.infer<typeof ImportPreviewResponse>;

const transferCounts = {
  processed: z.number().int().nonnegative(),
  written: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
};

export const REPORT_ID_PATTERN = /^[A-Za-z0-9_-]{22,128}$/;

export const ImportProgressEvent = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("progress"), ...transferCounts }),
  z.strictObject({
    type: z.literal("done"),
    ...transferCounts,
    errorsReportId: z.string().regex(REPORT_ID_PATTERN).optional(),
  }),
]);

export type ImportProgressEvent = z.infer<typeof ImportProgressEvent>;

export const ExportSummary = z.strictObject({
  __summary: z.strictObject({
    items: z.number().int().nonnegative(),
    bytes: z.number().int().nonnegative(),
  }),
});

export type ExportSummary = z.infer<typeof ExportSummary>;
