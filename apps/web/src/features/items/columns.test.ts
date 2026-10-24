import { describe, expect, it } from "vitest";
import {
  cappedAttributes,
  columnStorageKey,
  orderedAttributes,
  readColumnPrefs,
} from "./columns.js";

describe("orderedAttributes", () => {
  it("pins the partition key, then the sort key, then first-seen names", () => {
    const first = orderedAttributes(
      [{ createdAt: { S: "b" }, status: { S: "SHIPPED" }, userId: { S: "a" } }],
      [
        { name: "userId", keyType: "HASH" },
        { name: "createdAt", keyType: "RANGE" },
      ],
    );
    expect(first).toEqual(["userId", "createdAt", "status"]);
    const second = orderedAttributes(
      [{ createdAt: { S: "b" }, status: { S: "SHIPPED" }, userId: { S: "a" }, note: { S: "n" } }],
      [
        { name: "userId", keyType: "HASH" },
        { name: "createdAt", keyType: "RANGE" },
      ],
    );
    expect(second.slice(0, 3)).toEqual(["userId", "createdAt", "status"]);
    expect(second.at(-1)).toBe("note");
  });

  it("shows the first 200 columns until the rest are revealed", () => {
    const names = Array.from({ length: 500 }, (_unused, index) => `attr-${String(index)}`);
    expect(cappedAttributes(names, false).visible).toHaveLength(200);
    expect(cappedAttributes(names, false).hiddenCount).toBe(300);
    expect(cappedAttributes(names, true).visible).toHaveLength(500);
  });
});

describe("column prefs", () => {
  it("keys storage by a hash and ignores secrets", async () => {
    const key = await columnStorageKey("http://127.0.0.1:8000", "us-east-1", "orders");
    const other = await columnStorageKey("http://127.0.0.1:8000", "us-east-1", "users");
    expect(key.startsWith("ds-columns:")).toBe(true);
    expect(key).not.toContain("8000");
    expect(key).not.toContain("secret");
    expect(key).not.toBe(other);
    expect(
      readColumnPrefs(JSON.stringify({ hidden: ["note"], widths: { note: 80 }, revealed: true })),
    ).toEqual({
      hidden: ["note"],
      widths: { note: 80 },
      revealed: true,
    });
  });
});
