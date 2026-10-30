import { describe, expect, it } from "vitest";
import {
  CsvDecoder,
  ImportParseError,
  JsonArrayDecoder,
  LineDecoder,
  checkImportItem,
  itemFromCsv,
  itemFromText,
  rejectUtf16,
  stripBom,
} from "./import-parse.js";

const keys = [{ name: "id", type: "S" as const }];

describe("import parsers", () => {
  it("strips a UTF-8 BOM, rejects UTF-16, and keeps CRLF lines", () => {
    expect(stripBom(Uint8Array.from([0xef, 0xbb, 0xbf, 0x61]))).toEqual(Uint8Array.from([0x61]));
    expect(() => {
      rejectUtf16(Uint8Array.from([0xff, 0xfe, 0x61]));
    }).toThrow(ImportParseError);
    const lines = new LineDecoder();
    expect(lines.push("one\r\ntwo\r\n")).toEqual(["one", "two"]);
    expect(lines.push("three")).toEqual([]);
    expect(lines.finish()).toEqual(["three"]);
  });

  it("parses quoted CSV, a short row, and keeps 007 as a string", () => {
    const csv = new CsvDecoder();
    const rows = csv.push('id,note,qty\n"say ""hi"",\nnext",café,007\n', ",");
    expect(rows[0]).toEqual(["id", "note", "qty"]);
    expect(rows[1]?.[0]).toBe('say "hi",\nnext');
    expect(rows[1]?.[1]).toBe("café");
    const mapping = {
      header: true,
      delimiter: ",",
      columns: [
        { name: "id", type: "S" as const },
        { name: "note", type: "S" as const },
        { name: "qty", type: "S" as const },
      ],
    };
    const item = itemFromCsv(rows[1] ?? [], mapping, rows[0]);
    expect(item.qty).toEqual({ S: "007" });
    expect(() => {
      itemFromCsv(["only"], mapping, ["id", "note", "qty"]);
    }).toThrow(/note is missing/);
  });

  it("splits a JSON array that contains braces inside strings", () => {
    const decoder = new JsonArrayDecoder();
    const values = decoder.push('[{"note":"a}b"},{"id":"2"}]');
    expect(decoder.finish()).toEqual([]);
    expect(values).toHaveLength(2);
    expect(itemFromText(values[0] ?? "")).toEqual({ note: { S: "a}b" } });
    expect(itemFromText('{"id":{"S":"1"}}')).toEqual({ id: { S: "1" } });
    expect(() => {
      new JsonArrayDecoder().push("{");
    }).toThrow(/array/);
    const truncated = new JsonArrayDecoder();
    truncated.push('[{"id":"1"}');
    expect(() => {
      truncated.finish();
    }).toThrow(/ended before/);
  });

  it("reports a missing key and an item over 400 KB", () => {
    expect(checkImportItem({ note: { S: "a" } }, keys)).toMatch(/Missing key id/);
    const huge = { id: { S: "a" }, blob: { S: "x".repeat(410_000) } };
    expect(checkImportItem(huge, keys)).toMatch(/400 KB/);
    expect(checkImportItem({ id: { S: "a" } }, keys)).toBeUndefined();
  });
});
