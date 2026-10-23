import { describe, expect, it } from "vitest";
import { interpretEndpoint } from "./endpoint.js";

describe("interpretEndpoint", () => {
  it("prefixes localhost and treats it as local", () => {
    expect(interpretEndpoint("localhost:8000")).toMatchObject({
      endpoint: "http://localhost:8000",
      loopback: true,
      suggestedAuth: "local",
      suggestedEnv: "local",
    });
  });

  it("strips a trailing slash and keeps a path", () => {
    expect(interpretEndpoint("http://localhost:8000/").endpoint).toBe("http://localhost:8000");
    expect(interpretEndpoint("http://host:8000/ddb/").endpoint).toBe("http://host:8000/ddb");
  });

  it("infers https and the region from an AWS host", () => {
    expect(interpretEndpoint("dynamodb.us-east-1.amazonaws.com")).toMatchObject({
      endpoint: "https://dynamodb.us-east-1.amazonaws.com",
      region: "us-east-1",
      loopback: false,
      suggestedAuth: "default-chain",
      suggestedEnv: "dev",
    });
    expect(interpretEndpoint("http://dynamodb.eu-west-1.amazonaws.com/").endpoint).toBe(
      "https://dynamodb.eu-west-1.amazonaws.com",
    );
  });

  it("accepts IPv6 and docker loopback hosts", () => {
    expect(interpretEndpoint("[::1]:8000")).toMatchObject({
      endpoint: "http://[::1]:8000",
      loopback: true,
    });
    expect(interpretEndpoint("http://host.docker.internal:8000").loopback).toBe(true);
  });

  it("treats a blank endpoint as real AWS", () => {
    expect(interpretEndpoint("   ")).toMatchObject({
      blank: true,
      suggestedAuth: "default-chain",
      suggestedEnv: "dev",
    });
  });

  it("does not parse an AWS CLI command", () => {
    const result = interpretEndpoint(
      "aws dynamodb list-tables --endpoint-url http://localhost:8000",
    );
    expect(result.endpoint).toBeUndefined();
    expect(result.hint).toBe("That looks like a command. Paste the endpoint URL instead.");
  });

  it("rejects non-http schemes and credentials in the URL", () => {
    expect(interpretEndpoint("file:///etc/passwd").error).toBe("Enter a valid http or https URL.");
    expect(interpretEndpoint("http://user:secret@localhost:8000").error).toBe(
      "Remove credentials from the URL and use the auth fields.",
    );
  });
});
