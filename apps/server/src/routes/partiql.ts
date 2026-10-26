import type { FastifyPluginCallback, FastifyRequest } from "fastify";
import {
  CONFIRM_HEADER,
  PARTIQL_STATEMENT_BYTES,
  PartiqlRequest,
  classifyStatement,
} from "@dynamo-studio/shared";
import { z } from "zod";
import { executePartiql } from "../dynamo/partiql.js";
import { HttpError } from "../http-error.js";

const ConnectionParams = z.strictObject({ id: z.string().min(1) });

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

function headerValue(request: FastifyRequest): string | undefined {
  const value = request.headers[CONFIRM_HEADER];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

export const partiqlRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post("/api/v1/connections/:id/partiql", async (request) => {
    const params = ConnectionParams.parse(request.params);
    const body = PartiqlRequest.parse(request.body ?? {});
    if (Buffer.byteLength(body.statement, "utf8") > PARTIQL_STATEMENT_BYTES) {
      throw new HttpError("LIMIT_EXCEEDED", "PartiQL statements are limited to 8192 bytes.");
    }
    const id = sessionId(request);
    const open = app.connections.open(id, params.id);
    if (classifyStatement(body.statement) === "mutation") {
      app.connections.assertWritable(id, params.id);
      if (headerValue(request) !== "mutation") {
        throw new HttpError("VALIDATION", "Confirm this mutation before it runs.");
      }
    }
    return executePartiql(open.client, open.endpoint, {
      statement: body.statement,
      limit: body.limit,
      ...(body.parameters === undefined ? {} : { parameters: body.parameters }),
      ...(body.cursor === undefined ? {} : { cursor: body.cursor }),
      ...(body.consistentRead === undefined ? {} : { consistentRead: body.consistentRead }),
      signal: requestSignal(request),
    });
  });
  done();
};
