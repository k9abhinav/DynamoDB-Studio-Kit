import type { FastifyPluginCallback, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  BatchDeleteRequest,
  BatchDeleteResponse,
  DeleteItemRequest,
  DeleteItemResponse,
  GetItemRequest,
  GetItemResponse,
  ItemWriteResponse,
  PutItemRequest,
  TABLE_NAME_PATTERN,
  UpdateItemRequest,
} from "@dynamo-studio/shared";
import { batchDeleteItems } from "../dynamo/batch-delete.js";
import { deleteItem, getItem, putItem, updateItem, type ItemScope } from "../dynamo/items.js";
import { HttpError } from "../http-error.js";

const TableParams = z.strictObject({
  id: z.string().min(1),
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

export const itemRoutes: FastifyPluginCallback = (app, _options, done) => {
  const base = "/api/v1/connections/:id/tables/:table";

  app.post(`${base}/items/get`, async (request) => {
    const params = TableParams.parse(request.params);
    const body = GetItemRequest.parse(request.body);
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    const item = await getItem(scope(open, params.table, request), body.key);
    return GetItemResponse.parse({ item });
  });

  app.put(`${base}/items`, async (request) => {
    const params = TableParams.parse(request.params);
    const body = PutItemRequest.parse(request.body);
    const id = sessionId(request);
    app.connections.assertWritable(id, params.id);
    const open = app.connections.open(id, params.id);
    return ItemWriteResponse.parse(
      await putItem(scope(open, params.table, request), {
        item: body.item,
        ...(body.ifNotExists === undefined ? {} : { ifNotExists: body.ifNotExists }),
        ...(body.expectedHash === undefined ? {} : { expectedHash: body.expectedHash }),
      }),
    );
  });

  app.post(`${base}/items/update`, async (request) => {
    const params = TableParams.parse(request.params);
    const body = UpdateItemRequest.parse(request.body);
    const id = sessionId(request);
    app.connections.assertWritable(id, params.id);
    const open = app.connections.open(id, params.id);
    return ItemWriteResponse.parse(
      await updateItem(scope(open, params.table, request), {
        key: body.key,
        item: body.item,
        ...(body.expectedHash === undefined ? {} : { expectedHash: body.expectedHash }),
      }),
    );
  });

  app.post(`${base}/items/batch-delete`, async (request) => {
    const params = TableParams.parse(request.params);
    const body = BatchDeleteRequest.parse(request.body);
    const id = sessionId(request);
    app.connections.assertWritable(id, params.id);
    const open = app.connections.open(id, params.id);
    return BatchDeleteResponse.parse(
      await batchDeleteItems(scope(open, params.table, request), body.keys),
    );
  });

  app.post(`${base}/items/delete`, async (request) => {
    const params = TableParams.parse(request.params);
    const body = DeleteItemRequest.parse(request.body);
    const id = sessionId(request);
    app.connections.assertWritable(id, params.id);
    const open = app.connections.open(id, params.id);
    return DeleteItemResponse.parse(
      await deleteItem(scope(open, params.table, request), {
        key: body.key,
        ...(body.expectedHash === undefined ? {} : { expectedHash: body.expectedHash }),
      }),
    );
  });

  done();
};

function scope(
  open: { client: ItemScope["client"]; endpoint: string },
  table: string,
  request: FastifyRequest,
): ItemScope {
  return {
    client: open.client,
    endpoint: open.endpoint,
    table,
    signal: requestSignal(request),
  };
}
