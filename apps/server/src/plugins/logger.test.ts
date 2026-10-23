import { describe, expect, it } from "vitest";
import { captureLogger, serializeRequest } from "./logger.js";

describe("createLogger", () => {
  it("redacts secrets", () => {
    const captured = captureLogger();
    captured.logger.info(
      {
        secretAccessKey: "super-secret-value",
        nested: { sessionToken: "session-token-value", Authorization: "Bearer secret-header" },
      },
      "connect",
    );
    const line = captured.read();
    expect(line).not.toContain("super-secret-value");
    expect(line).not.toContain("session-token-value");
    expect(line).not.toContain("secret-header");
    expect(line).toContain("[Redacted]");
  });

  it("logs the method and url without headers", () => {
    expect(
      serializeRequest({
        method: "POST",
        url: "/api/v1/connections",
        headers: { authorization: "Bearer secret-header" },
      }),
    ).toEqual({ method: "POST", url: "/api/v1/connections" });
  });
});
