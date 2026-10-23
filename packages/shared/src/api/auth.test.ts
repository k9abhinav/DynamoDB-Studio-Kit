import { describe, expect, it } from "vitest";
import { Auth } from "./auth.js";

describe("Auth", () => {
  it("trims access keys and drops a blank session token", () => {
    expect(
      Auth.parse({
        type: "keys",
        accessKeyId: "  key  ",
        secretAccessKey: "  secret  ",
        sessionToken: "   ",
      }),
    ).toEqual({
      type: "keys",
      accessKeyId: "key",
      secretAccessKey: "secret",
    });
  });

  it("keeps a trimmed session token", () => {
    expect(
      Auth.parse({
        type: "keys",
        accessKeyId: "key",
        secretAccessKey: "secret",
        sessionToken: " token ",
      }),
    ).toEqual({
      type: "keys",
      accessKeyId: "key",
      secretAccessKey: "secret",
      sessionToken: "token",
    });
  });

  it("rejects unknown keys and unknown auth types", () => {
    expect(Auth.safeParse({ type: "local", extra: true }).success).toBe(false);
    expect(Auth.safeParse({ type: "sso" }).success).toBe(false);
  });

  it("trims a profile name", () => {
    expect(Auth.parse({ type: "profile", profile: "  dev  " })).toEqual({
      type: "profile",
      profile: "dev",
    });
  });
});
