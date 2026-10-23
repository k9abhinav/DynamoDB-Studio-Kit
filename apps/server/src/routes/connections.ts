import type { FastifyPluginCallback } from "fastify";
import { z } from "zod";
import {
  ActiveConnectionList,
  CONNECT_RATE_LIMIT_PER_MINUTE,
  ConnectionHeartbeat,
  CreateConnectionBody,
  CreateConnectionResponse,
  PatchConnectionBody,
  TestConnectionBody,
  TestConnectionResponse,
} from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";

const Params = z.strictObject({ id: z.string().min(1) });

const connectLimit = {
  config: {
    rateLimit: {
      max: CONNECT_RATE_LIMIT_PER_MINUTE,
      timeWindow: 60_000,
    },
  },
};

function sessionId(request: { session: { id: string } | null }): string {
  if (request.session === null) {
    throw new HttpError("UNAUTHENTICATED", "Session expired. Reconnect.");
  }
  return request.session.id;
}

export const connectionRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.post("/api/v1/connections/test", connectLimit, async (request) => {
    const body = TestConnectionBody.parse(request.body);
    const result = await app.connections.test(body);
    return TestConnectionResponse.parse({ ok: true, ...result });
  });

  app.post("/api/v1/connections", connectLimit, async (request, reply) => {
    const body = CreateConnectionBody.parse(request.body);
    const id = sessionId(request);
    const created = CreateConnectionResponse.parse(await app.connections.create(id, body));
    if (body.remember) {
      try {
        await app.profiles.remember({
          name: created.summary.name,
          endpoint: created.summary.endpoint,
          region: created.summary.region,
          env: created.summary.env,
          readOnly: created.summary.readOnly,
          auth: body.auth,
        });
      } catch (error) {
        app.connections.remove(id, created.connectionId);
        throw error;
      }
    }
    return reply.code(201).send(created);
  });

  app.get("/api/v1/connections", (request) => {
    return ActiveConnectionList.parse(app.connections.list(sessionId(request)));
  });

  app.get("/api/v1/connections/:id", async (request) => {
    const params = Params.parse(request.params);
    return ConnectionHeartbeat.parse(
      await app.connections.heartbeat(sessionId(request), params.id),
    );
  });

  app.patch("/api/v1/connections/:id", (request) => {
    const params = Params.parse(request.params);
    const body = PatchConnectionBody.parse(request.body);
    return CreateConnectionResponse.parse(
      app.connections.patch(sessionId(request), params.id, body),
    );
  });

  app.delete("/api/v1/connections/:id", async (request, reply) => {
    const params = Params.parse(request.params);
    app.connections.remove(sessionId(request), params.id);
    return reply.code(204).send();
  });

  done();
};
