import type { FastifyPluginCallback, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  QueryRequest,
  ScanRequest,
  TABLE_NAME_PATTERN,
  TableListQuery,
  TableListResponse,
} from "@dynamo-studio/shared";
import { queryTable } from "../dynamo/query.js";
import { scanTable } from "../dynamo/scan.js";
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

  app.post("/api/v1/connections/:id/tables/:table/scan", async (request) => {
    const params = TableParams.parse(request.params);
    const body = ScanRequest.parse(request.body ?? {});
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    return scanTable(open.client, open.endpoint, {
      table: params.table,
      limit: body.limit,
      filterJoiner: body.filterJoiner,
      ...(body.index === undefined ? {} : { index: body.index }),
      ...(body.cursor === undefined ? {} : { cursor: body.cursor }),
      ...(body.filters === undefined ? {} : { filters: body.filters }),
      ...(body.projection === undefined ? {} : { projection: body.projection }),
      ...(body.consistentRead === undefined ? {} : { consistentRead: body.consistentRead }),
      ...(body.segment === undefined ? {} : { segment: body.segment }),
      ...(body.fillPage === undefined ? {} : { fillPage: body.fillPage }),
      signal: requestSignal(request),
    });
  });

  app.post("/api/v1/connections/:id/tables/:table/query", async (request) => {
    const params = TableParams.parse(request.params);
    const body = QueryRequest.parse(request.body ?? {});
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    return queryTable(open.client, open.endpoint, {
      table: params.table,
      partitionKey: body.key.pk,
      scanForward: body.scanForward,
      limit: body.limit,
      filterJoiner: body.filterJoiner,
      ...(body.index === undefined ? {} : { index: body.index }),
      ...(body.key.sk === undefined
        ? {}
        : {
            sortKey: {
              name: body.key.sk.name,
              op: body.key.sk.op,
              value: body.key.sk.value,
              ...(body.key.sk.value2 === undefined ? {} : { value2: body.key.sk.value2 }),
            },
          }),
      ...(body.cursor === undefined ? {} : { cursor: body.cursor }),
      ...(body.filters === undefined ? {} : { filters: body.filters }),
      ...(body.projection === undefined ? {} : { projection: body.projection }),
      ...(body.consistentRead === undefined ? {} : { consistentRead: body.consistentRead }),
      ...(body.fillPage === undefined ? {} : { fillPage: body.fillPage }),
      signal: requestSignal(request),
    });
  });

  app.post("/api/v1/connections/:id/tables/:table/wait", async (request) => {
    const params = TableParams.parse(request.params);
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    return waitForActiveTable(open.client, open.endpoint, params.table, requestSignal(request));
  });

  done();
};
