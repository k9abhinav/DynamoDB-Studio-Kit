import { describe, expect, it } from "vitest";
import { CreateConnectionBody, PatchConnectionBody, TestConnectionBody } from "./connection.js";

const keys = { type: "keys" as const, accessKeyId: "key", secretAccessKey: "secret" };

describe("connection bodies", () => {
  it("rejects local auth when the endpoint is blank", () => {
    expect(
      TestConnectionBody.safeParse({ region: "us-east-1", auth: { type: "local" } }).success,
    ).toBe(false);
    expect(
      CreateConnectionBody.safeParse({
        region: "us-east-1",
        auth: { type: "local" },
        endpoint: "   ",
        env: "dev",
        readOnly: false,
        remember: false,
      }).success,
    ).toBe(false);
  });

  it("allows a blank endpoint with the default credential chain", () => {
    expect(
      TestConnectionBody.parse({ region: "us-east-1", auth: { type: "default-chain" } }),
    ).toEqual({ region: "us-east-1", auth: { type: "default-chain" } });
  });

  it("rejects unknown keys and a tableCountSample above 1", () => {
    expect(
      TestConnectionBody.safeParse({ region: "us-east-1", auth: keys, accountId: "1" }).success,
    ).toBe(false);
  });

  it("requires at least one patch field and rejects credential changes", () => {
    expect(PatchConnectionBody.safeParse({}).success).toBe(false);
    expect(PatchConnectionBody.safeParse({ readOnly: true }).success).toBe(true);
    expect(PatchConnectionBody.safeParse({ readOnly: true, auth: keys }).success).toBe(false);
  });
});
