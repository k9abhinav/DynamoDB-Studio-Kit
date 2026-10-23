import { describe, expect, it } from "vitest";
import { isConventionalCommit } from "./commit-message.js";

describe("isConventionalCommit", () => {
  it("rejects a bad message", () => {
    expect(isConventionalCommit("bad message")).toBe(false);
  });

  it("accepts chore: test", () => {
    expect(isConventionalCommit("chore: test")).toBe(true);
  });

  it("accepts a scoped message", () => {
    expect(isConventionalCommit("docs(specs): apply planning decisions")).toBe(true);
  });
});
