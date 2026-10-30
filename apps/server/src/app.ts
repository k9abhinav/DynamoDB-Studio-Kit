import { mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, sep } from "node:path";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { MAX_IMPORT_BYTES } from "@dynamo-studio/shared";
import { z } from "zod";
import { CONNECT_RATE_LIMIT_PER_MINUTE, type Auth } from "@dynamo-studio/shared";
import type { DestinationStream } from "pino";
import type { LogLevel } from "./config.js";
import { registerErrors, registerNotFound } from "./plugins/errors.js";
import { fastifyLoggerOptions } from "./plugins/logger.js";
import { registerSecurity, type SecurityOptions } from "./plugins/security.js";
import { connectionRoutes } from "./routes/connections.js";
import { healthRoutes } from "./routes/health.js";
import { profileRoutes } from "./routes/profiles.js";
import { createErrorReportStore } from "./dynamo/error-reports.js";
import { itemRoutes } from "./routes/items.js";
import { importRoutes } from "./routes/import.js";
import { partiqlRoutes } from "./routes/partiql.js";
import { tableRoutes } from "./routes/tables.js";
import { transferRoutes } from "./routes/transfer.js";
import { HttpError } from "./http-error.js";
import { createConnectionManager } from "./services/connection-manager.js";
import { createProfileStore } from "./store/profile-store.js";
import type { DynamoCaller } from "./services/credentials.js";
import "./types.js";

export interface BuildAppOptions extends SecurityOptions {
  logger?: boolean | { level: LogLevel; destination?: DestinationStream };
  staticRoot?: string;
  bodyLimit?: number;
  enableProbe?: boolean;
  studioHome?: string;
  createClient?: (input: { region: string; endpoint: string; auth: Auth }) => DynamoCaller;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = createServer(options);
  const connections = createConnectionManager(
    options.createClient === undefined ? {} : { createClient: options.createClient },
  );
  app.decorate("connections", connections);
  app.decorate(
    "profiles",
    createProfileStore(
      options.studioHome ??
        (process.env.NODE_ENV === "test"
          ? mkdtempSync(join(tmpdir(), "ds-profiles-"))
          : join(homedir(), ".dynamo-studio")),
    ),
  );
  await registerSecurity(app, {
    ...options,
    onExpire(sessionId) {
      connections.destroySession(sessionId);
      options.onExpire?.(sessionId);
    },
  });
  await app.register(rateLimit, {
    global: false,
    hook: "preHandler",
    max: CONNECT_RATE_LIMIT_PER_MINUTE,
    timeWindow: 60_000,
    keyGenerator(request) {
      return request.session?.id ?? request.ip;
    },
    errorResponseBuilder() {
      return new HttpError(
        "THROTTLED",
        "Too many connection attempts. Wait a minute and try again.",
        { retryable: true },
      );
    },
  });
  registerErrors(app);
  if (options.staticRoot !== undefined) {
    await app.register(fastifyStatic, {
      root: options.staticRoot,
      wildcard: false,
      setHeaders(reply, filePath) {
        if (filePath.includes(`${sep}assets${sep}`)) {
          reply.header("cache-control", "public, max-age=31536000, immutable");
        }
      },
    });
  }
  const reports = createErrorReportStore();
  app.decorate("errorReports", reports);
  app.addHook("onClose", () => {
    reports.close();
  });
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: MAX_IMPORT_BYTES,
      fields: 4,
      fieldSize: 64 * 1024,
      parts: 6,
    },
  });
  await app.register(healthRoutes);
  await app.register(connectionRoutes);
  await app.register(profileRoutes);
  await app.register(tableRoutes);
  await app.register(transferRoutes);
  await app.register(importRoutes);
  await app.register(itemRoutes);
  await app.register(partiqlRoutes);
  if (options.enableProbe ?? process.env.NODE_ENV === "test") {
    app.post("/api/v1/connections/:id/mutations/probe", async (request, reply) => {
      const params = z.strictObject({ id: z.string().min(1) }).parse(request.params);
      if (request.session === null) {
        throw new HttpError("UNAUTHENTICATED", "Session expired. Reconnect.");
      }
      app.connections.assertWritable(request.session.id, params.id);
      return reply.code(204).send();
    });
  }
  registerNotFound(app, options.staticRoot);
  return app;
}

function createServer(options: BuildAppOptions): FastifyInstance {
  const bodyLimit = options.bodyLimit ?? 2 * 1024 * 1024;
  const logger = options.logger;
  if (logger !== undefined && typeof logger !== "boolean") {
    return Fastify({
      bodyLimit,
      logger: {
        ...fastifyLoggerOptions(logger.level),
        ...(logger.destination === undefined ? {} : { stream: logger.destination }),
      },
    });
  }
  return Fastify({ bodyLimit, logger: logger ?? false });
}
