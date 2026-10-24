import { describe, expect, it } from "vitest";
import { formatBytes, tableStatusLabel, tableStatusTone } from "./present.js";

describe("table presentation", () => {
  it("treats archived and inaccessible tables as warnings and sizes as approximate display", () => {
    expect(tableStatusTone("ARCHIVED")).toBe("warning");
    expect(tableStatusTone("INACCESSIBLE_ENCRYPTION_CREDENTIALS")).toBe("warning");
    expect(tableStatusTone("CREATING")).toBe("progress");
    expect(tableStatusTone("ACTIVE")).toBe("ready");
    expect(tableStatusLabel("ARCHIVED")).toBe("Archived");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});
