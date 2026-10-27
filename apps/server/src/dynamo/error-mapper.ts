import type { ErrorCode, ErrorDetails } from "@dynamo-studio/shared";

export interface MappedError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details?: ErrorDetails;
}

const AWS_CODES = {
  ResourceNotFoundException: "NOT_FOUND",
  ConditionalCheckFailedException: "CONDITION_FAILED",
  ValidationException: "VALIDATION",
  ProvisionedThroughputExceededException: "THROTTLED",
  RequestLimitExceeded: "THROTTLED",
  ThrottlingException: "THROTTLED",
  ResourceInUseException: "TABLE_IN_USE",
  LimitExceededException: "LIMIT_EXCEEDED",
  ItemCollectionSizeLimitExceededException: "LIMIT_EXCEEDED",
  AccessDeniedException: "ACCESS_DENIED",
  UnrecognizedClientException: "ACCESS_DENIED",
  InvalidSignatureException: "ACCESS_DENIED",
  ExpiredTokenException: "ACCESS_DENIED",
  CredentialsProviderError: "ACCESS_DENIED",
  InternalFailure: "INTERNAL",
} as const satisfies Record<string, ErrorCode>;

const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTls(code: string | undefined, name: string): boolean {
  if (
    code !== undefined &&
    (code.startsWith("ERR_SSL") || code.startsWith("CERT_") || code.includes("TLS"))
  ) {
    return true;
  }
  return name.includes("TLS") || name.includes("SSL");
}

function readError(error: unknown): {
  name: string;
  message: string;
  code?: string;
  requestId?: string;
} {
  if (!isRecord(error)) {
    return { name: "Error", message: "Something went wrong." };
  }
  const name = typeof error.name === "string" ? error.name : "Error";
  const message = typeof error.message === "string" ? error.message : "Something went wrong.";
  const directCode = typeof error.code === "string" ? error.code : undefined;
  let requestId: string | undefined;
  if (isRecord(error.$metadata) && typeof error.$metadata.requestId === "string") {
    requestId = error.$metadata.requestId;
  }
  const result: { name: string; message: string; code?: string; requestId?: string } = {
    name,
    message,
  };
  if (directCode !== undefined) {
    result.code = directCode;
  }
  if (requestId !== undefined) {
    result.requestId = requestId;
  }
  return result;
}

function unreachable(endpoint: string | undefined, tls: boolean): string {
  if (tls) {
    return "Couldn't establish a secure connection.";
  }
  const target = endpoint === undefined || endpoint.length === 0 ? "the endpoint" : endpoint;
  return `Couldn't reach ${target}. Is DynamoDB running and the URL correct?`;
}

export function mapDynamoError(error: unknown, endpoint?: string): MappedError {
  const read = readError(error);
  const awsCode = read.name in AWS_CODES ? read.name : undefined;
  const code: ErrorCode =
    awsCode !== undefined
      ? AWS_CODES[awsCode as keyof typeof AWS_CODES]
      : read.name === "TimeoutError" ||
          read.name === "AbortError" ||
          (read.code !== undefined && NETWORK_CODES.has(read.code)) ||
          isTls(read.code, read.name)
        ? "ENDPOINT_UNREACHABLE"
        : "INTERNAL";

  const details: ErrorDetails = {};
  if (awsCode !== undefined) {
    details.awsCode = awsCode;
  }
  if (read.code !== undefined) {
    details.networkCode = read.code;
  }
  if (read.requestId !== undefined) {
    details.requestId = read.requestId;
  }
  const hasDetails =
    details.awsCode !== undefined ||
    details.networkCode !== undefined ||
    details.requestId !== undefined;

  let message = "Something went wrong.";
  if (awsCode === "InternalFailure") {
    message = "DynamoDB couldn't finish that change.";
  }
  if (code === "NOT_FOUND") {
    message = "That table doesn't exist (anymore).";
  } else if (code === "CONDITION_FAILED") {
    message = "This item changed since you opened it.";
  } else if (code === "VALIDATION") {
    message = /deletion protection/i.test(read.message)
      ? "Deletion protection is on. Turn it off, then delete the table."
      : read.message.slice(0, 500);
  } else if (code === "THROTTLED") {
    message = "DynamoDB is throttling requests.";
  } else if (code === "TABLE_IN_USE") {
    message = /already exists|preexisting table/i.test(read.message)
      ? "That table name is already in use."
      : "Table is busy. Try again when it's ACTIVE.";
  } else if (code === "LIMIT_EXCEEDED") {
    message = "DynamoDB rejected the request because a limit was exceeded.";
  } else if (code === "ACCESS_DENIED") {
    message =
      awsCode === "AccessDeniedException"
        ? "These credentials can't list tables (missing dynamodb:ListTables)."
        : "AWS rejected these credentials.";
  } else if (code === "ENDPOINT_UNREACHABLE") {
    message = unreachable(endpoint, isTls(read.code, read.name));
  }

  return {
    code,
    message,
    retryable: code === "THROTTLED" || code === "ENDPOINT_UNREACHABLE",
    ...(hasDetails ? { details } : {}),
  };
}
