import { z } from "zod";

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().min(1).default("127.0.0.1"),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  DYNAMO_STUDIO_HOME: z.string().min(1).optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  MAX_EXPORT_ITEMS: z.string().optional(),
});

export type LogLevel = (typeof logLevels)[number];

export interface AppConfig {
  port: number;
  host: string;
  logLevel: LogLevel;
  dynamoStudioHome?: string;
  allowedOrigins?: string;
  maxExportItems?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = EnvSchema.parse({
    ...(env.PORT === undefined ? {} : { PORT: env.PORT }),
    ...(env.HOST === undefined ? {} : { HOST: env.HOST }),
    ...(env.LOG_LEVEL === undefined ? {} : { LOG_LEVEL: env.LOG_LEVEL }),
    ...(env.DYNAMO_STUDIO_HOME === undefined ? {} : { DYNAMO_STUDIO_HOME: env.DYNAMO_STUDIO_HOME }),
    ...(env.ALLOWED_ORIGINS === undefined ? {} : { ALLOWED_ORIGINS: env.ALLOWED_ORIGINS }),
    ...(env.MAX_EXPORT_ITEMS === undefined ? {} : { MAX_EXPORT_ITEMS: env.MAX_EXPORT_ITEMS }),
  });

  const config: AppConfig = {
    port: parsed.PORT,
    host: parsed.HOST,
    logLevel: parsed.LOG_LEVEL,
  };
  if (parsed.DYNAMO_STUDIO_HOME !== undefined) {
    config.dynamoStudioHome = parsed.DYNAMO_STUDIO_HOME;
  }
  if (parsed.ALLOWED_ORIGINS !== undefined) {
    config.allowedOrigins = parsed.ALLOWED_ORIGINS;
  }
  if (parsed.MAX_EXPORT_ITEMS !== undefined) {
    config.maxExportItems = parsed.MAX_EXPORT_ITEMS;
  }
  return config;
}

export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function hostBindingWarning(host: string): string | undefined {
  if (isLoopbackHost(host)) {
    return undefined;
  }
  return `HOST is ${host}, which is not loopback. DynamoDB Studio is exposed beyond this machine.`;
}
