import { MAX_IMPORT_BYTES, type CsvMapping, type Item } from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";
import {
  CsvDecoder,
  ImportParseError,
  JsonArrayDecoder,
  LineDecoder,
  itemFromCsv,
  itemFromText,
  rejectUtf16,
  stripBom,
  type ParsedImportRow,
} from "./import-parse.js";

const IMPORT_FRAMING_BYTES = 1024 * 1024;

export const IMPORT_REQUEST_LIMIT = MAX_IMPORT_BYTES + IMPORT_FRAMING_BYTES;

export async function* parseImport(input: {
  bytes: AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
  format: "ndjson" | "json" | "csv";
  mapping?: CsvMapping;
  maxBytes?: number;
  maxRows?: number;
  warnings?: string[];
}): AsyncGenerator<ParsedImportRow> {
  const maxBytes = input.maxBytes ?? MAX_IMPORT_BYTES;
  let seen = 0;
  let produced = 0;
  let first = true;
  const lines = new LineDecoder();
  const csv = new CsvDecoder();
  const json = new JsonArrayDecoder();
  let headers: string[] | undefined;
  let csvRow = 0;
  let jsonRow = 0;
  let ndjsonRow = 0;
  const decoder = new TextDecoder("utf-8", { fatal: false });

  for await (const chunk of byteStream(input.bytes)) {
    seen += chunk.byteLength;
    if (seen > maxBytes) {
      throw new HttpError("LIMIT_EXCEEDED", "That file is over 512 MB.");
    }
    const textChunk = first ? openChunk(chunk, input.warnings) : chunk;
    first = false;
    let text = decoder.decode(textChunk, { stream: true });
    if (input.format === "ndjson") {
      const ready = lines.push(text);
      text = "";
      for (let index = 0; index < ready.length; index += 1) {
        let line = ready[index] ?? "";
        ready[index] = "";
        const row = ndjsonRow + 1;
        ndjsonRow = row;
        let parsed = ndjsonLine(line, row);
        line = "";
        if (parsed === undefined) {
          continue;
        }
        yield parsed;
        parsed = undefined;
        produced += 1;
        if (input.maxRows !== undefined && produced >= input.maxRows) {
          return;
        }
      }
    } else if (input.format === "json") {
      const ready = json.push(text);
      text = "";
      for (let index = 0; index < ready.length; index += 1) {
        let value = ready[index] ?? "";
        ready[index] = "";
        jsonRow += 1;
        let parsed: ParsedImportRow | undefined = jsonValue(value, jsonRow);
        value = "";
        yield parsed;
        parsed = undefined;
        produced += 1;
        if (input.maxRows !== undefined && produced >= input.maxRows) {
          return;
        }
      }
    } else {
      const delimiter = input.mapping?.delimiter ?? ",";
      const ready = csv.push(text, delimiter);
      text = "";
      for (let index = 0; index < ready.length; index += 1) {
        const cells = ready[index] ?? [];
        ready[index] = [];
        csvRow += 1;
        if (input.mapping?.header !== false && headers === undefined) {
          headers = cells;
          continue;
        }
        let parsed: ParsedImportRow | undefined = csvValue(cells, csvRow, input.mapping, headers);
        yield parsed;
        parsed = undefined;
        produced += 1;
        if (input.maxRows !== undefined && produced >= input.maxRows) {
          return;
        }
      }
    }
  }
  const flushed = decoder.decode();
  if (flushed.length > 0) {
    if (input.format === "ndjson") {
      for (const line of lines.push(flushed)) {
        ndjsonRow += 1;
        const parsed = ndjsonLine(line, ndjsonRow);
        if (parsed !== undefined) {
          yield parsed;
        }
      }
    } else if (input.format === "json") {
      for (const value of json.push(flushed)) {
        jsonRow += 1;
        yield jsonValue(value, jsonRow);
      }
    } else {
      const delimiter = input.mapping?.delimiter ?? ",";
      for (const cells of csv.push(flushed, delimiter)) {
        csvRow += 1;
        if (input.mapping?.header !== false && headers === undefined) {
          headers = cells;
          continue;
        }
        yield csvValue(cells, csvRow, input.mapping, headers);
      }
    }
  }
  if (input.format === "ndjson") {
    for (const line of lines.finish()) {
      ndjsonRow += 1;
      const parsed = ndjsonLine(line, ndjsonRow);
      if (parsed !== undefined) {
        yield parsed;
      }
    }
  } else if (input.format === "json") {
    for (const value of finishJson(json)) {
      jsonRow += 1;
      yield jsonValue(value, jsonRow);
    }
  } else {
    for (const cells of finishCsv(csv)) {
      csvRow += 1;
      if (input.mapping?.header !== false && headers === undefined) {
        headers = cells;
        continue;
      }
      yield csvValue(cells, csvRow, input.mapping, headers);
    }
  }
}

export async function previewImport(
  bytes: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
  filename: string,
): Promise<{
  detectedFormat: "ndjson" | "json" | "csv";
  sample: Item[];
  inferredColumns?: { name: string; type: "S" }[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const detectedFormat = formatFromName(filename);
  const sample: Item[] = [];
  let headers: string[] | undefined;
  for await (const row of parseImport({
    bytes,
    format: detectedFormat,
    maxRows: 20,
    warnings,
  })) {
    if (row.item === undefined) {
      warnings.push(`Row ${String(row.row)}: ${row.error ?? "This row is not an item."}`);
      continue;
    }
    sample.push(row.item);
    headers ??= Object.keys(row.item);
  }
  return {
    detectedFormat,
    sample,
    warnings,
    ...(detectedFormat === "csv"
      ? { inferredColumns: (headers ?? []).map((name) => ({ name, type: "S" as const })) }
      : {}),
  };
}

async function* byteStream(
  source: AsyncIterable<Uint8Array> | Iterable<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  for await (const chunk of source) {
    if (!(chunk instanceof Uint8Array)) {
      throw new HttpError("VALIDATION", "Import data must be bytes.");
    }
    yield chunk;
  }
}

function openChunk(chunk: Uint8Array, warnings: string[] | undefined): Uint8Array {
  rejectUtf16(chunk);
  const stripped = stripBom(chunk);
  if (stripped.length !== chunk.length) {
    warnings?.push("A UTF-8 BOM was removed.");
  }
  return stripped;
}

function ndjsonLine(line: string, row: number): ParsedImportRow | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.includes('"__summary"')) {
    return undefined;
  }
  try {
    return { row, item: itemFromText(trimmed) };
  } catch (error) {
    return { row, error: messageOf(error) };
  }
}

function jsonValue(value: string, row: number): ParsedImportRow {
  try {
    return { row, item: itemFromText(value) };
  } catch (error) {
    return { row, error: messageOf(error) };
  }
}

function csvValue(
  cells: readonly string[],
  row: number,
  mapping: CsvMapping | undefined,
  headers: readonly string[] | undefined,
): ParsedImportRow {
  const columns =
    mapping?.columns ?? (headers ?? cells).map((name) => ({ name, type: "S" as const }));
  try {
    return {
      row,
      item: itemFromCsv(
        cells,
        { header: headers !== undefined, delimiter: mapping?.delimiter ?? ",", columns },
        headers,
      ),
    };
  } catch (error) {
    return { row, error: messageOf(error) };
  }
}

function finishJson(json: JsonArrayDecoder): string[] {
  try {
    return json.finish();
  } catch (error) {
    if (error instanceof ImportParseError) {
      throw new HttpError("VALIDATION", error.message);
    }
    throw error;
  }
}

function finishCsv(csv: CsvDecoder): string[][] {
  try {
    return csv.finish();
  } catch (error) {
    if (error instanceof ImportParseError) {
      throw new HttpError("VALIDATION", error.message);
    }
    throw error;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "This row is not an item.";
}

function formatFromName(filename: string): "ndjson" | "json" | "csv" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  if (lower.endsWith(".json")) {
    return "json";
  }
  return "ndjson";
}
