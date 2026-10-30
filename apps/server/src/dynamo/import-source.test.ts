import { describe, expect, it } from "vitest";
import { HttpError } from "../http-error.js";
import { parseImport, previewImport } from "./import-source.js";

function textChunks(text: string): Uint8Array[] {
  return [new TextEncoder().encode(text)];
}

async function rowsOf(text: string, format: "ndjson" | "json" | "csv") {
  const rows = [];
  for await (const row of parseImport({
    bytes: textChunks(text),
    format,
    ...(format === "csv"
      ? {
          mapping: {
            header: true,
            delimiter: ",",
            columns: [
              { name: "id", type: "S" as const },
              { name: "note", type: "S" as const },
            ],
          },
        }
      : {}),
  })) {
    rows.push(row);
  }
  return rows;
}

describe("parseImport", () => {
  it("skips the export summary and stops a preview at 20 rows", async () => {
    const lines = Array.from({ length: 25 }, (_unused, index) => `{"id":{"S":"${String(index)}"}}`);
    lines.push('{"__summary":{"items":25,"bytes":1}}');
    const parsed = await rowsOf(`${lines.join("\n")}\n`, "ndjson");
    expect(parsed).toHaveLength(25);
    expect(parsed[0]?.item).toEqual({ id: { S: "0" } });
    const preview = await previewImport(textChunks(`${lines.join("\n")}\n`), "rows.ndjson");
    expect(preview.sample).toHaveLength(20);
    expect(preview.detectedFormat).toBe("ndjson");
  });

  it("rejects a file over the byte limit and keeps quoted CSV text", async () => {
    const limited = parseImport({
      bytes: textChunks("0123456789"),
      format: "ndjson",
      maxBytes: 4,
    });
    await expect(limited.next()).rejects.toBeInstanceOf(HttpError);
    const csv = await rowsOf('id,note\n"a","say ""hi"", café"\n', "csv");
    expect(csv[0]?.item).toEqual({ id: { S: "a" }, note: { S: 'say "hi", café' } });
  });
});
