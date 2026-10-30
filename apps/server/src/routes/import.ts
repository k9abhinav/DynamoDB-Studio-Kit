import { Readable } from "node:stream";
import type { FastifyInstance, FastifyPluginCallback, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  ImportOptions,
  ImportPreviewResponse,
  ImportProgressEvent,
  REPORT_ID_PATTERN,
  TABLE_NAME_PATTERN,
  type ItemKeySpec,
} from "@dynamo-studio/shared";
import { describeConnectionTable } from "../dynamo/table-api.js";
import { IMPORT_REQUEST_LIMIT, parseImport, previewImport } from "../dynamo/import-source.js";
import { writeImport, type ImportCounts } from "../dynamo/import-write.js";
import { HttpError } from "../http-error.js";

const TableParams = z.strictObject({
  id: z.string().min(1),
  table: z.string().regex(TABLE_NAME_PATTERN),
});

const importLimit = { bodyLimit: IMPORT_REQUEST_LIMIT };

export const importRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post(
    "/api/v1/connections/:id/tables/:table/import/preview",
    { bodyLimit: IMPORT_REQUEST_LIMIT, preHandler: rejectHugeRequest },
    async (request) => {
      const params = TableParams.parse(request.params);
      const session = sessionId(request);
      app.connections.assertWritable(session, params.id);
      const upload = await readUpload(request, false);
      try {
        return ImportPreviewResponse.parse(await previewImport(upload.bytes, upload.filename));
      } finally {
        upload.destroy();
      }
    },
  );

  app.post(
    "/api/v1/connections/:id/tables/:table/import",
    { ...importLimit, preHandler: rejectHugeRequest },
    async (request, reply) => {
      const params = TableParams.parse(request.params);
      const session = sessionId(request);
      app.connections.assertWritable(session, params.id);
      const open = app.connections.open(session, params.id);
      const signal = requestSignal(request);
      const described = await describeConnectionTable(
        open.client,
        open.endpoint,
        params.table,
        signal,
      );
      const upload = await readUpload(request, true);
      const keys = keySpecs(described.keySchema);
      reply.header("content-type", "application/x-ndjson; charset=utf-8");
      return reply.send(
        Readable.from(
          progressEvents(app, session, params.id, upload, open, params.table, keys, signal),
        ),
      );
    },
  );

  app.get("/api/v1/connections/:id/import/errors/:reportId", async (request, reply) => {
    const params = z
      .strictObject({ id: z.string().min(1), reportId: z.string().min(1) })
      .parse(request.params);
    const session = sessionId(request);
    app.connections.open(session, params.id);
    if (!REPORT_ID_PATTERN.test(params.reportId)) {
      throw new HttpError("NOT_FOUND", "That error report is not available.");
    }
    const stream = app.errorReports.open(session, params.id, params.reportId);
    if (stream === undefined) {
      throw new HttpError("NOT_FOUND", "That error report is not available.");
    }
    reply.header("content-type", "application/x-ndjson; charset=utf-8");
    return reply.send(stream);
  });

  done();
};

async function* progressEvents(
  app: FastifyInstance,
  session: string,
  connectionId: string,
  upload: Upload,
  open: { client: Parameters<typeof describeConnectionTable>[0]; endpoint: string },
  table: string,
  keys: readonly ItemKeySpec[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  let reportId: string | undefined;
  let write: (line: string) => void = () => undefined;
  let last: ImportCounts | undefined;
  try {
    for await (const counts of writeImport({
      scope: { client: open.client, endpoint: open.endpoint, table, signal },
      keys,
      mode: upload.options.mode,
      dryRun: upload.options.dryRun,
      rows: parseImport({
        bytes: upload.bytes,
        format: upload.options.format,
        ...(upload.options.mapping === undefined ? {} : { mapping: upload.options.mapping }),
      }),
      onFailure(failure) {
        if (reportId === undefined) {
          const report = app.errorReports.create(session, connectionId);
          reportId = report.id;
          write = (line: string) => {
            report.write(line);
          };
        }
        write(JSON.stringify({ row: failure.row, reason: failure.reason }));
      },
    })) {
      if (last !== undefined) {
        yield `${JSON.stringify({ type: "progress", ...last })}\n`;
      }
      last = counts;
    }
  } finally {
    upload.destroy();
  }
  const doneEvent: ImportProgressEvent = {
    type: "done",
    processed: last?.processed ?? 0,
    written: last?.written ?? 0,
    skipped: last?.skipped ?? 0,
    failed: last?.failed ?? 0,
    duplicates: last?.duplicates ?? 0,
    ...(reportId === undefined ? {} : { errorsReportId: reportId }),
  };
  yield `${JSON.stringify(ImportProgressEvent.parse(doneEvent))}\n`;
}

interface Upload {
  options: ImportOptions;
  filename: string;
  bytes: AsyncIterable<Uint8Array>;
  destroy: () => void;
}

async function readUpload(request: FastifyRequest, requireOptions: boolean): Promise<Upload> {
  if (!request.isMultipart()) {
    throw new HttpError("VALIDATION", "Import expects a multipart file.");
  }
  let options: ImportOptions | undefined;
  for await (const part of request.parts()) {
    if (part.type === "field" && part.fieldname === "options") {
      if (typeof part.value !== "string") {
        throw new HttpError("VALIDATION", "Import options must be JSON.");
      }
      options = ImportOptions.parse(parseOptions(part.value));
      continue;
    }
    if (part.type === "file" && part.fieldname === "file") {
      if (requireOptions && options === undefined) {
        part.file.destroy();
        throw new HttpError("VALIDATION", "Send the options field before the file.");
      }
      const filename = part.filename;
      return {
        options: options ?? ImportOptions.parse({ format: formatOf(filename), mode: "put" }),
        filename,
        bytes: byteChunks(part.file),
        destroy: () => {
          part.file.destroy();
        },
      };
    }
  }
  throw new HttpError("VALIDATION", "Choose a file to import.");
}

function parseOptions(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new HttpError("VALIDATION", "Import options must be JSON.");
  }
}

async function* byteChunks(source: AsyncIterable<Uint8Array>): AsyncGenerator<Uint8Array> {
  for await (const chunk of source) {
    yield chunk;
  }
}

function formatOf(filename: string): "ndjson" | "json" | "csv" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  if (lower.endsWith(".json")) {
    return "json";
  }
  return "ndjson";
}

function keySpecs(keys: readonly { name: string; type: string }[]): ItemKeySpec[] {
  const specs: ItemKeySpec[] = [];
  for (const key of keys) {
    if (key.type === "S" || key.type === "N" || key.type === "B") {
      specs.push({ name: key.name, type: key.type });
    }
  }
  if (specs.length === 0) {
    throw new HttpError("VALIDATION", "This table has no key schema.");
  }
  return specs;
}

export function rejectHugeRequest(request: FastifyRequest): Promise<void> {
  const length = Number(request.headers["content-length"]);
  if (Number.isFinite(length) && length > IMPORT_REQUEST_LIMIT) {
    return Promise.reject(new HttpError("LIMIT_EXCEEDED", "That file is over 512 MB."));
  }
  return Promise.resolve();
}

function sessionId(request: { session: { id: string } | null }): string {
  if (request.session === null) {
    throw new HttpError("UNAUTHENTICATED", "Session expired. Reconnect.");
  }
  return request.session.id;
}

function requestSignal(request: FastifyRequest): AbortSignal {
  const controller = new AbortController();
  request.raw.once("aborted", () => {
    controller.abort();
  });
  return controller.signal;
}
