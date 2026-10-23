import type { ErrorCode, ErrorDetails } from "@dynamo-studio/shared";

export class HttpError extends Error {
  readonly details?: ErrorDetails;
  readonly retryable: boolean;

  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: { details?: ErrorDetails; retryable?: boolean },
  ) {
    super(message);
    this.name = "HttpError";
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    this.retryable = options?.retryable ?? code === "THROTTLED";
  }
}
