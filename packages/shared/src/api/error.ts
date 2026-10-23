import { z } from "zod";

export const ErrorCode = z.enum([
  "VALIDATION",
  "UNAUTHENTICATED",
  "FORBIDDEN_ORIGIN",
  "READ_ONLY",
  "ACCESS_DENIED",
  "NOT_FOUND",
  "CONDITION_FAILED",
  "TABLE_IN_USE",
  "LIMIT_EXCEEDED",
  "THROTTLED",
  "ENDPOINT_UNREACHABLE",
  "PARTIQL_ERROR",
  "INTERNAL",
]);

export type ErrorCode = z.infer<typeof ErrorCode>;

export const ERROR_STATUS = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN_ORIGIN: 403,
  READ_ONLY: 403,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  CONDITION_FAILED: 409,
  TABLE_IN_USE: 409,
  LIMIT_EXCEEDED: 400,
  THROTTLED: 429,
  ENDPOINT_UNREACHABLE: 502,
  PARTIQL_ERROR: 400,
  INTERNAL: 500,
} as const satisfies Record<ErrorCode, number>;

const ErrorField = z.strictObject({
  path: z.string(),
  message: z.string(),
});

export const ErrorDetails = z.strictObject({
  awsCode: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
  networkCode: z.string().min(1).optional(),
  fields: z.array(ErrorField).optional(),
});

export type ErrorDetails = z.infer<typeof ErrorDetails>;

export const ErrorResponse = z.strictObject({
  error: z.strictObject({
    code: ErrorCode,
    message: z.string().min(1),
    details: ErrorDetails.optional(),
    retryable: z.boolean(),
    requestId: z.string().min(1),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponse>;

export function errorResponse(input: {
  code: ErrorCode;
  message: string;
  requestId: string;
  details?: ErrorDetails;
  retryable?: boolean;
}): ErrorResponse {
  return ErrorResponse.parse({
    error: {
      code: input.code,
      message: input.message,
      retryable: input.retryable ?? input.code === "THROTTLED",
      requestId: input.requestId,
      ...(input.details === undefined ? {} : { details: input.details }),
    },
  });
}
