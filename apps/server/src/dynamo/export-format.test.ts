import { describe, expect, it } from "vitest";
import type { Item } from "@dynamo-studio/shared";
import { createItemEncoder } from "./export-format.js";

const wide: Item = {
  id: { S: 'say "hi", then\nnext' },
  note: { S: "café 東京" },
  qty: { N: "12345678901234567890123456789012345678" },
  address: { M: { city: { S: "Pune" } } },
};

describe("export format", () => {
  it("escapes CSV quotes, commas, newlines, and unicode, and flattens nested values", () => {
    const encoder = createItemEncoder("csv", false);
    const text = `${encoder.item(wide)}${encoder.item({
      id: { S: "later" },
      extra: { BOOL: true },
    })}`;
    expect(text.startsWith("address,id,note,qty,_extra\n")).toBe(true);
    expect(text).toContain('"say ""hi"", then\nnext"');
    expect(text).toContain("café 東京");
    expect(text).toContain("12345678901234567890123456789012345678");
    expect(text).toContain('"{""city"":""Pune""}"');
    expect(text).toContain('"{""extra"":""true""}"');
    expect(encoder.warnings).toEqual([
      "Nested values were written as JSON strings.",
      "Columns that were not in the first row are in _extra.",
    ]);
    expect(encoder.finish({ items: 2, bytes: 10 })).toBe("");
  });

  it("writes plain NDJSON with a summary and a JSON array without one", () => {
    const ndjson = createItemEncoder("ndjson", false);
    const lines = `${ndjson.item({ id: { N: "12345678901234567890123456789012345678" } })}${ndjson.finish({ items: 1, bytes: 9 })}`;
    expect(lines).toBe(
      '{"id":12345678901234567890123456789012345678}\n{"__summary":{"items":1,"bytes":9}}\n',
    );
    const array = createItemEncoder("json", true);
    const typed = `${array.item({ id: { S: "a" } })}${array.item({ id: { S: "b" } })}${array.finish({ items: 2, bytes: 1 })}`;
    expect(typed).toBe('[\n{"id":{"S":"a"}},\n{"id":{"S":"b"}}\n]\n');
    expect(typed).not.toContain("__summary");
    expect(createItemEncoder("json", false).finish({ items: 0, bytes: 0 })).toBe("[]\n");
  });
});
