import { describe, expect, it } from "vitest";
import { mapDynamoError } from "./error-mapper.js";

const cases: { name?: string; code?: string; expected: string; message?: string }[] = [
  { name: "ResourceNotFoundException", expected: "NOT_FOUND" },
  { name: "ConditionalCheckFailedException", expected: "CONDITION_FAILED" },
  { name: "ValidationException", expected: "VALIDATION" },
  { name: "ProvisionedThroughputExceededException", expected: "THROTTLED" },
  { name: "RequestLimitExceeded", expected: "THROTTLED" },
  { name: "ThrottlingException", expected: "THROTTLED" },
  { name: "ResourceInUseException", expected: "TABLE_IN_USE" },
  { name: "LimitExceededException", expected: "LIMIT_EXCEEDED" },
  { name: "ItemCollectionSizeLimitExceededException", expected: "LIMIT_EXCEEDED" },
  { name: "AccessDeniedException", expected: "ACCESS_DENIED" },
  { name: "UnrecognizedClientException", expected: "ACCESS_DENIED" },
  { name: "InvalidSignatureException", expected: "ACCESS_DENIED" },
  { name: "ExpiredTokenException", expected: "ACCESS_DENIED" },
  { name: "CredentialsProviderError", expected: "ACCESS_DENIED" },
  { code: "ECONNREFUSED", expected: "ENDPOINT_UNREACHABLE" },
  { code: "ENOTFOUND", expected: "ENDPOINT_UNREACHABLE" },
  { code: "ETIMEDOUT", expected: "ENDPOINT_UNREACHABLE" },
  { code: "EAI_AGAIN", expected: "ENDPOINT_UNREACHABLE" },
  { code: "CERT_HAS_EXPIRED", expected: "ENDPOINT_UNREACHABLE" },
  { name: "TimeoutError", expected: "ENDPOINT_UNREACHABLE" },
];

describe("mapDynamoError", () => {
  it.each(cases)("maps $name $code to $expected", ({ name, code, expected }) => {
    const error = Object.assign(new Error("boom"), {
      ...(name === undefined ? {} : { name }),
      ...(code === undefined ? {} : { code }),
      $metadata: { requestId: "aws-req" },
    });
    const mapped = mapDynamoError(error, "http://localhost:8000");
    expect(mapped.code).toBe(expected);
    expect(mapped.details?.requestId).toBe("aws-req");
  });

  it("uses the friendly unreachable and credential sentences", () => {
    expect(
      mapDynamoError(
        Object.assign(new Error("nope"), { code: "ECONNREFUSED" }),
        "http://localhost:8000",
      ).message,
    ).toBe("Couldn't reach http://localhost:8000. Is DynamoDB running and the URL correct?");
    expect(
      mapDynamoError(Object.assign(new Error("tls"), { code: "CERT_HAS_EXPIRED" })).message,
    ).toBe("Couldn't establish a secure connection.");
    expect(
      mapDynamoError(Object.assign(new Error("denied"), { name: "AccessDeniedException" })).message,
    ).toBe("These credentials can't list tables (missing dynamodb:ListTables).");
    expect(
      mapDynamoError(Object.assign(new Error("bad"), { name: "UnrecognizedClientException" }))
        .message,
    ).toBe("AWS rejected these credentials.");
  });

  it("keeps unknown failures internal and retryable only when the call can be repeated", () => {
    expect(mapDynamoError(new Error("mystery")).code).toBe("INTERNAL");
    expect(
      mapDynamoError(Object.assign(new Error("slow"), { name: "ThrottlingException" })).retryable,
    ).toBe(true);
    expect(mapDynamoError(new Error("mystery")).retryable).toBe(false);
  });
});
