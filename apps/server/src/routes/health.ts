import type { FastifyPluginCallback } from "fastify";
import { HealthResponse } from "@dynamo-studio/shared";
import { readPackageVersion } from "../version.js";

export const healthRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.get("/api/v1/health", () => {
    return HealthResponse.parse({ ok: true, version: readPackageVersion() });
  });
  done();
};
