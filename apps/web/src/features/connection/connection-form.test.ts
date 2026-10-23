import { describe, expect, it } from "vitest";
import {
  applyUntouchedDefaults,
  connectDefaults,
  toCreateBody,
  toTestBody,
} from "./connection-form.js";

const untouched = { auth: false, env: false, region: false };

describe("connection form", () => {
  it("defaults a loopback URL to local auth before the debounce paints", () => {
    const next = applyUntouchedDefaults(
      { ...connectDefaults, endpoint: "localhost:8000" },
      untouched,
    );
    expect(toCreateBody(next)).toMatchObject({
      endpoint: "http://localhost:8000",
      auth: { type: "local" },
      env: "local",
      remember: false,
    });
  });

  it("keeps a chosen auth method and trims key material", () => {
    const next = applyUntouchedDefaults(
      {
        ...connectDefaults,
        endpoint: "http://localhost:8000",
        authType: "keys",
        accessKeyId: " key ",
        secretAccessKey: " secret ",
        sessionToken: "   ",
        remember: true,
      },
      { ...untouched, auth: true },
    );
    expect(toTestBody(next).auth).toEqual({
      type: "keys",
      accessKeyId: "key",
      secretAccessKey: "secret",
    });
    expect(toCreateBody(next).remember).toBe(true);
  });

  it("infers the region from an AWS endpoint when the field is untouched", () => {
    const next = applyUntouchedDefaults(
      { ...connectDefaults, endpoint: "dynamodb.us-west-2.amazonaws.com" },
      untouched,
    );
    expect(next.region).toBe("us-west-2");
    expect(next.authType).toBe("default-chain");
    expect(toCreateBody(next).endpoint).toBe("https://dynamodb.us-west-2.amazonaws.com");
  });
});
