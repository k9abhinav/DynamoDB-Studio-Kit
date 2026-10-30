import { Readable } from "node:stream";
import type { FastifyPluginCallback, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  ConfirmNameBody,
  ImportProgressEvent,
  TABLE_NAME_PATTERN,
  type ImportProgressEvent as ProgressEvent,
  type ItemKeySpec,
} from "@dynamo-studio/shared";
import { clearPages } from "../dynamo/clear-table.js";
import type { ImportCounts } from "../dynamo/import-write.js";
import { assertNameConfirm } from "../dynamo/manage-table.js";
import { scanTable } from "../dynamo/scan.js";
import { describeConnectionTable } from "../dynamo/table-api.js";
import { HttpError } from "../http-error.js";

const TableParams = z.strictObject({
  id: z.string().min(1),
  table: z.string().regex(TABLE_NAME_PATTERN),
});

export const clearRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post("/api/v1/connections/:id/tables/:table/clear", async (request, reply) => {
    const params = TableParams.parse(request.params);
    const body = ConfirmNameBody.parse(request.body ?? {});
    const session = sessionId(request);
    app.connections.assertWritable(session, params.id);
    assertNameConfirm(body.confirm, params.table);
    const open = app.connections.open(session, params.id);
    const signal = requestSignal(request);
    const described = await describeConnectionTable(
      open.client,
      open.endpoint,
      params.table,
      signal,
    );
    const keys = keySpecs(described.keySchema);
    reply.header("content-type", "application/x-ndjson; charset=utf-8");
    return reply.send(
      Readable.from(progress(open.client, open.endpoint, params.table, keys, signal)),
    );
  });
  done();
};

async function* progress(
  client: Parameters<typeof scanTable>[0],
  endpoint: string,
  table: string,
  keys: readonly ItemKeySpec[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  let last: ImportCounts | undefined;
  for await (const counts of clearPages({
    scope: { client, endpoint, table, signal },
    async load(cursor) {
      const page = await scanTable(client, endpoint, {
        table,
        limit: 100,
        filterJoiner: "and",
        projection: keys.map((key) => key.name),
        consistentRead: true,
        signal,
        ...(cursor === undefined ? {} : { cursor }),
      });
      return {
        items: page.items,
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      };
    },
  })) {
    if (last !== undefined) {
      yield `${JSON.stringify({ type: "progress", ...last } satisfies ProgressEvent)}\n`;
    }
    last = counts;
  }
  const done: ProgressEvent = {
    type: "done",
    processed: last?.processed ?? 0,
    written: last?.written ?? 0,
    skipped: 0,
    failed: last?.failed ?? 0,
    duplicates: 0,
  };
  yield `${JSON.stringify(ImportProgressEvent.parse(done))}\n`;
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
