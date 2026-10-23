import { describe, expect, it } from "vitest";
import { errorCopy } from "./error-copy.js";

describe("errorCopy", () => {
  it("uses the connect sentences", () => {
    expect(
      errorCopy({ code: "ENDPOINT_UNREACHABLE", message: "raw" }, "http://localhost:8000"),
    ).toBe("Couldn't reach http://localhost:8000. Is DynamoDB running and the URL correct?");
    expect(
      errorCopy({
        code: "ENDPOINT_UNREACHABLE",
        message: "raw",
        details: { networkCode: "CERT_HAS_EXPIRED" },
      }),
    ).toBe("Couldn't establish a secure connection.");
    expect(
      errorCopy({
        code: "ACCESS_DENIED",
        message: "raw",
        details: { awsCode: "UnrecognizedClientException" },
      }),
    ).toBe("AWS rejected these credentials.");
    expect(
      errorCopy({
        code: "ACCESS_DENIED",
        message: "raw",
        details: { awsCode: "AccessDeniedException" },
      }),
    ).toBe("These credentials can't list tables (missing dynamodb:ListTables).");
  });
});
