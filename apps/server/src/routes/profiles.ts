import type { FastifyPluginCallback } from "fastify";
import { z } from "zod";
import {
  CONNECT_RATE_LIMIT_PER_MINUTE,
  CreateConnectionResponse,
  PatchProfileBody,
  ProfileList,
} from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";

const Params = z.strictObject({ id: z.string().min(1) });

function sessionId(request: { session: { id: string } | null }): string {
  if (request.session === null) {
    throw new HttpError("UNAUTHENTICATED", "Session expired. Reconnect.");
  }
  return request.session.id;
}

export const profileRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.get("/api/v1/profiles", async () => {
    return ProfileList.parse(await app.profiles.list());
  });

  app.post(
    "/api/v1/profiles/:id/connect",
    {
      config: {
        rateLimit: { max: CONNECT_RATE_LIMIT_PER_MINUTE, timeWindow: 60_000 },
      },
    },
    async (request, reply) => {
      const params = Params.parse(request.params);
      const draft = await app.profiles.connect(params.id);
      const created = await app.connections.create(sessionId(request), {
        region: draft.region,
        auth: draft.auth,
        name: draft.name,
        env: draft.env,
        readOnly: draft.readOnly,
        remember: false,
        ...(draft.endpoint.length === 0 ? {} : { endpoint: draft.endpoint }),
      });
      return reply.code(201).send(CreateConnectionResponse.parse(created));
    },
  );

  app.patch("/api/v1/profiles/:id", async (request) => {
    const params = Params.parse(request.params);
    const body = PatchProfileBody.parse(request.body);
    return app.profiles.patch(params.id, body);
  });

  app.delete("/api/v1/profiles/:id", async (request, reply) => {
    const params = Params.parse(request.params);
    await app.profiles.remove(params.id);
    return reply.code(204).send();
  });

  done();
};
