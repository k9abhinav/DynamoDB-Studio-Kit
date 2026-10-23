import { Writable } from "node:stream";
import pino, { type DestinationStream, type Logger } from "pino";
import type { LogLevel } from "../config.js";

const redactPaths = [
  "secretAccessKey",
  "*.secretAccessKey",
  "sessionToken",
  "*.sessionToken",
  "Authorization",
  "*.Authorization",
  "req.headers.authorization",
];

export function fastifyLoggerOptions(level: LogLevel): {
  level: LogLevel;
  redact: { paths: string[]; censor: string };
} {
  return {
    level,
    redact: { paths: redactPaths, censor: "[Redacted]" },
  };
}

export function createLogger(level: LogLevel, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      redact: { paths: redactPaths, censor: "[Redacted]" },
    },
    destination ?? pino.destination(1),
  );
}

export function captureLogger(level: LogLevel = "info"): { logger: Logger; read: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      callback();
    },
  });
  return {
    logger: createLogger(level, stream),
    read: () => chunks.join(""),
  };
}
