import Fastify, { type FastifyInstance } from "fastify";
import type { LogLevel } from "./config.js";
import { fastifyLoggerOptions } from "./plugins/logger.js";
import { healthRoutes } from "./routes/health.js";

export interface BuildAppOptions {
  logger?: boolean | { level: LogLevel };
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = createServer(options.logger);
  await app.register(healthRoutes);
  return app;
}

function createServer(logger: BuildAppOptions["logger"]): FastifyInstance {
  if (logger !== undefined && typeof logger !== "boolean") {
    return Fastify({ logger: fastifyLoggerOptions(logger.level) });
  }
  return Fastify({ logger: logger ?? false });
}
