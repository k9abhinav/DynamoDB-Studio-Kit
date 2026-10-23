import { sep } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import type { LogLevel } from "./config.js";
import { registerErrors, registerNotFound } from "./plugins/errors.js";
import { fastifyLoggerOptions } from "./plugins/logger.js";
import { registerSecurity, type SecurityOptions } from "./plugins/security.js";
import { healthRoutes } from "./routes/health.js";
import "./types.js";

export interface BuildAppOptions extends SecurityOptions {
  logger?: boolean | { level: LogLevel };
  staticRoot?: string;
  bodyLimit?: number;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = createServer(options);
  await registerSecurity(app, options);
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
  await app.register(healthRoutes);
  registerNotFound(app, options.staticRoot);
  return app;
}

function createServer(options: BuildAppOptions): FastifyInstance {
  const bodyLimit = options.bodyLimit ?? 2 * 1024 * 1024;
  const logger = options.logger;
  if (logger !== undefined && typeof logger !== "boolean") {
    return Fastify({ bodyLimit, logger: fastifyLoggerOptions(logger.level) });
  }
  return Fastify({ bodyLimit, logger: logger ?? false });
}
