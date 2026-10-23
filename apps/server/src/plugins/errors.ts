import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { ERROR_STATUS, errorResponse } from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = error.statusCode;
    if (typeof statusCode === "number") {
      return statusCode;
    }
  }
  return undefined;
}

function zodErrorOf(error: unknown): ZodError | undefined {
  if (error instanceof ZodError) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    error.cause instanceof ZodError
  ) {
    return error.cause;
  }
  return undefined;
}

export function registerErrors(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    reply.header("x-request-id", request.id);
    const zodError = zodErrorOf(error);
    if (zodError !== undefined) {
      return reply.status(ERROR_STATUS.VALIDATION).send(
        errorResponse({
          code: "VALIDATION",
          message: "Check the highlighted fields.",
          requestId: request.id,
          details: {
            fields: zodError.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        }),
      );
    }
    if (error instanceof HttpError) {
      return reply.status(ERROR_STATUS[error.code]).send(
        errorResponse({
          code: error.code,
          message: error.message,
          requestId: request.id,
          retryable: error.retryable,
          ...(error.details === undefined ? {} : { details: error.details }),
        }),
      );
    }
    const statusCode = statusCodeOf(error);
    if (statusCode === 413) {
      return reply.status(ERROR_STATUS.LIMIT_EXCEEDED).send(
        errorResponse({
          code: "LIMIT_EXCEEDED",
          message: "Request body is too large.",
          requestId: request.id,
        }),
      );
    }
    if (statusCode === 429) {
      return reply.status(ERROR_STATUS.THROTTLED).send(
        errorResponse({
          code: "THROTTLED",
          message: "Too many connection attempts. Wait a minute and try again.",
          requestId: request.id,
          retryable: true,
        }),
      );
    }
    request.log.error({ name: error instanceof Error ? error.name : "Error" }, "request failed");
    return reply.status(ERROR_STATUS.INTERNAL).send(
      errorResponse({
        code: "INTERNAL",
        message: "Something went wrong.",
        requestId: request.id,
      }),
    );
  });
}

export function registerNotFound(app: FastifyInstance, staticRoot: string | undefined): void {
  app.setNotFoundHandler((request, reply) => {
    reply.header("x-request-id", request.id);
    const path = request.url.split("?")[0] ?? request.url;
    if (path.startsWith("/api")) {
      reply.header("cache-control", "no-store");
      return reply.status(ERROR_STATUS.NOT_FOUND).send(
        errorResponse({
          code: "NOT_FOUND",
          message: "That route does not exist.",
          requestId: request.id,
        }),
      );
    }
    if (staticRoot !== undefined) {
      return reply.sendFile("index.html");
    }
    return reply.status(404).type("text/plain").send("Not found");
  });
}
