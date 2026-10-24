import type { FastifyPluginCallback, FastifyRequest } from "fastify";
import { z } from "zod";
import { TABLE_NAME_PATTERN, TableListQuery, TableListResponse } from "@dynamo-studio/shared";
import {
  describeConnectionTable,
  listConnectionTables,
  waitForActiveTable,
} from "../dynamo/table-api.js";
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

export const tableRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.get("/api/v1/connections/:id/tables", async (request) => {
    const params = ConnectionParams.parse(request.params);
    const query = TableListQuery.parse(request.query);
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    const listed = await listConnectionTables(open.client, open.endpoint, {
      limit: query.limit ?? 100,
      ...(query.search === undefined || query.search.length === 0 ? {} : { search: query.search }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      signal: requestSignal(request),
    });
    return TableListResponse.parse(listed);
  });

  app.get("/api/v1/connections/:id/tables/:table", async (request) => {
    const params = TableParams.parse(request.params);
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    return describeConnectionTable(
      open.client,
      open.endpoint,
      params.table,
      requestSignal(request),
    );
  });

  app.post("/api/v1/connections/:id/tables/:table/wait", async (request) => {
    const params = TableParams.parse(request.params);
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    return waitForActiveTable(open.client, open.endpoint, params.table, requestSignal(request));
  });

  done();
};
