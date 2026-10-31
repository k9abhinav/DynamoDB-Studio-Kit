import { describe, expect, it } from "vitest";
import { takeProgressLines } from "./progress.js";

describe("takeProgressLines", () => {
  it("keeps a partial line and reads a finished event", () => {
    const first = takeProgressLines('{"type":"progress","processed":');
    expect(first.events).toEqual([]);
    const second = takeProgressLines(
      `${first.rest}1,"written":1,"skipped":0,"failed":0,"duplicates":0}\n`,
    );
    expect(second.events).toEqual([
      { type: "progress", processed: 1, written: 1, skipped: 0, failed: 0, duplicates: 0 },
    ]);
  });
});
