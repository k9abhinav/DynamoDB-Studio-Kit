import { describe, expect, it } from "vitest";
import { readCommitHash } from "./commit-hash.js";

describe("readCommitHash", () => {
  it("returns unknown when git is absent", () => {
    expect(
      readCommitHash(() => {
        throw new Error("git not found");
      }),
    ).toBe("unknown");
  });

  it("returns unknown for an empty hash", () => {
    expect(readCommitHash(() => " \n")).toBe("unknown");
  });

  it("keeps a short hash", () => {
    expect(readCommitHash(() => "abc1234\n")).toBe("abc1234");
  });
});
