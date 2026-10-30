import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPORT_ID_PATTERN } from "@dynamo-studio/shared";
import { createErrorReportStore } from "./error-reports.js";

async function readAll(stream: AsyncIterable<Buffer | string>): Promise<string> {
  let text = "";
  for await (const chunk of stream) {
    text += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  }
  return text;
}

describe("error reports", () => {
  it("keeps a private report for one session and connection, then deletes it", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ds-report-"));
    const store = createErrorReportStore({
      directory,
      schedule: () => ({ cancel() {} }),
    });
    const report = store.create("session-a", "conn-a");
    report.write(JSON.stringify({ row: 4, reason: "Missing key id." }));
    expect(REPORT_ID_PATTERN.test(report.id)).toBe(true);
    expect(statSync(join(directory, report.id)).mode & 0o777).toBe(0o600);
    expect(store.open("session-b", "conn-a", report.id)).toBeUndefined();
    expect(store.open("session-a", "conn-b", report.id)).toBeUndefined();
    const opened = store.open("session-a", "conn-a", report.id);
    if (opened === undefined) {
      throw new Error("missing report");
    }
    expect(await readAll(opened)).toContain('"row":4');
    store.close();
    expect(() => statSync(join(directory, report.id))).toThrow();
  });

  it("drops a report an hour after it was created", () => {
    const directory = mkdtempSync(join(tmpdir(), "ds-report-"));
    let now = 0;
    const store = createErrorReportStore({
      directory,
      now: () => now,
      schedule: () => ({ cancel() {} }),
    });
    const report = store.create("session-a", "conn-a");
    now = 60 * 60 * 1000 + 1;
    expect(store.open("session-a", "conn-a", report.id)).toBeUndefined();
    store.close();
  });
});
