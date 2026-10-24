import { describe, expect, it } from "vitest";
import { TABLE_POLL_MS, tablePollInterval } from "./use-table.js";

describe("tablePollInterval", () => {
  it("polls only while a table is creating, updating, or deleting", () => {
    expect(tablePollInterval("CREATING")).toBe(TABLE_POLL_MS);
    expect(tablePollInterval("UPDATING")).toBe(TABLE_POLL_MS);
    expect(tablePollInterval("DELETING")).toBe(TABLE_POLL_MS);
    expect(tablePollInterval("ACTIVE")).toBe(false);
    expect(tablePollInterval("ARCHIVED")).toBe(false);
    expect(tablePollInterval("INACCESSIBLE_ENCRYPTION_CREDENTIALS")).toBe(false);
    expect(tablePollInterval(undefined)).toBe(false);
  });
});
