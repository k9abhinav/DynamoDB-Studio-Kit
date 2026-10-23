import { describe, expect, it } from "vitest";
import { ERROR_STATUS, ErrorResponse, errorResponse } from "./error.js";

describe("ErrorResponse", () => {
  it("accepts the contract shape and rejects extra keys", () => {
    const body = errorResponse({
      code: "NOT_FOUND",
      message: "That table doesn't exist (anymore).",
      requestId: "req-1",
      details: { awsCode: "ResourceNotFoundException" },
    });
    expect(body.error.retryable).toBe(false);
    expect(ErrorResponse.safeParse({ ...body, extra: true }).success).toBe(false);
    expect(
      ErrorResponse.safeParse({ error: { ...body.error, secretAccessKey: "x" } }).success,
    ).toBe(false);
  });

  it("marks throttling as retryable", () => {
    expect(
      errorResponse({ code: "THROTTLED", message: "Slow down.", requestId: "req-2" }).error
        .retryable,
    ).toBe(true);
  });

  it("maps every code to the contract status", () => {
    expect(ERROR_STATUS.VALIDATION).toBe(400);
    expect(ERROR_STATUS.UNAUTHENTICATED).toBe(401);
    expect(ERROR_STATUS.FORBIDDEN_ORIGIN).toBe(403);
    expect(ERROR_STATUS.READ_ONLY).toBe(403);
    expect(ERROR_STATUS.ACCESS_DENIED).toBe(403);
    expect(ERROR_STATUS.NOT_FOUND).toBe(404);
    expect(ERROR_STATUS.CONDITION_FAILED).toBe(409);
    expect(ERROR_STATUS.TABLE_IN_USE).toBe(409);
    expect(ERROR_STATUS.LIMIT_EXCEEDED).toBe(400);
    expect(ERROR_STATUS.THROTTLED).toBe(429);
    expect(ERROR_STATUS.ENDPOINT_UNREACHABLE).toBe(502);
    expect(ERROR_STATUS.PARTIQL_ERROR).toBe(400);
    expect(ERROR_STATUS.INTERNAL).toBe(500);
  });
});
