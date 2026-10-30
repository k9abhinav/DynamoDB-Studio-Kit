import { Readable } from "node:stream";
import type { FastifyPluginCallback, FastifyRequest } from "fastify";
import { z } from "zod";
import { ExportRequest, TABLE_NAME_PATTERN } from "@dynamo-studio/shared";
import { exportChunks, exportMedia, exportPageLoader } from "../dynamo/export-stream.js";
import { HttpError } from "../http-error.js";

const ConnectionParams = z.strictObject({ id: z.string().min(1) });
const TableParams = ConnectionParams.extend({
  table: z.string().regex(TABLE_NAME_PATTERN),
});

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

async function* continueExport(
  first: IteratorResult<string>,
  source: AsyncIterator<string>,
): AsyncGenerator<string> {
  if (!first.done) {
    yield first.value;
  }
  for (;;) {
    const next = await source.next();
    if (next.done) {
      return;
    }
    yield next.value;
  }
}

export const transferRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post("/api/v1/connections/:id/tables/:table/export", async (request, reply) => {
    const params = TableParams.parse(request.params);
    const body = ExportRequest.parse(request.body ?? {});
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    const signal = requestSignal(request);
    const source = exportChunks({
      request: body,
      signal,
      page: exportPageLoader(open.client, open.endpoint, params.table, body, signal),
    })[Symbol.asyncIterator]();
    const first = await source.next();
    const media = exportMedia(body.format, params.table);
    reply.header("content-type", media.type);
    reply.header("content-disposition", `attachment; filename="${media.filename}"`);
    return reply.send(Readable.from(continueExport(first, source)));
  });

  done();
};
