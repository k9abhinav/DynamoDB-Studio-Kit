import {
  ITEM_SIZE_LIMIT,
  Item,
  PlainJsonError,
  estimateItemSize,
  fromPlain,
  fromPlainItem,
  isDynamoNumber,
  parsePlain,
  type AttributeValue,
  type CsvMapping,
  type Item as TypedItem,
  type ItemKeySpec,
} from "@dynamo-studio/shared";

export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportParseError";
  }
}

export interface ParsedImportRow {
  row: number;
  item?: TypedItem;
  error?: string;
}

const ATTRIBUTE_KEYS = new Set(["S", "N", "B", "BOOL", "NULL", "L", "M", "SS", "NS", "BS"]);

export function rejectUtf16(bytes: Uint8Array): void {
  if (bytes.length < 2) {
    return;
  }
  const first = bytes[0];
  const second = bytes[1];
  if ((first === 0xff && second === 0xfe) || (first === 0xfe && second === 0xff)) {
    throw new ImportParseError("This file looks like UTF-16. Save it as UTF-8.");
  }
}

export function stripBom(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return bytes.subarray(3);
  }
  return bytes;
}

export class LineDecoder {
  private parts: string[] = [];
  private pendingCr = false;

  push(text: string): string[] {
    if (text.length === 0) {
      return [];
    }
    const lines: string[] = [];
    let slice = text;
    if (this.pendingCr) {
      this.pendingCr = false;
      if (slice.startsWith("\n")) {
        slice = slice.slice(1);
      }
    }
    let cursor = 0;
    for (let index = 0; index < slice.length; index += 1) {
      const code = slice.charCodeAt(index);
      if (code !== 10 && code !== 13) {
        continue;
      }
      this.parts.push(slice.slice(cursor, index));
      lines.push(this.parts.join(""));
      this.parts = [];
      if (code === 13) {
        const next = index + 1;
        if (next >= slice.length) {
          this.pendingCr = true;
        } else if (slice.charCodeAt(next) === 10) {
          index = next;
        }
      }
      cursor = index + 1;
    }
    if (cursor < slice.length) {
      this.parts.push(slice.slice(cursor));
    }
    return lines;
  }

  finish(): string[] {
    this.pendingCr = false;
    if (this.parts.length === 0) {
      return [];
    }
    const last = this.parts.join("");
    this.parts = [];
    return [last];
  }
}

export class CsvDecoder {
  private field = "";
  private row: string[] = [];
  private quoted = false;
  private pendingQuote = false;

  push(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    for (const char of text) {
      const finished = this.pushChar(char, delimiter);
      if (finished !== undefined) {
        rows.push(finished);
      }
    }
    return rows;
  }

  finish(): string[][] {
    if (this.quoted) {
      throw new ImportParseError("A quoted CSV field was not closed.");
    }
    if (this.field.length === 0 && this.row.length === 0) {
      return [];
    }
    this.row.push(this.field);
    const row = this.row;
    this.field = "";
    this.row = [];
    return [row];
  }

  private pushChar(char: string, delimiter: string): string[] | undefined {
    if (this.pendingQuote) {
      this.pendingQuote = false;
      if (char === '"') {
        this.field += '"';
        return undefined;
      }
      this.quoted = false;
    }
    if (char === '"') {
      if (this.quoted) {
        this.pendingQuote = true;
        return undefined;
      }
      if (this.field.length === 0) {
        this.quoted = true;
        return undefined;
      }
    }
    if (!this.quoted && char === delimiter) {
      this.row.push(this.field);
      this.field = "";
      return undefined;
    }
    if (!this.quoted && (char === "\n" || char === "\r")) {
      if (char === "\r") {
        return undefined;
      }
      this.row.push(this.field);
      const row = this.row;
      this.field = "";
      this.row = [];
      return row;
    }
    this.field += char;
    return undefined;
  }
}

export class JsonArrayDecoder {
  private pending = "";
  private started = false;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private valueStart = -1;

  push(text: string): string[] {
    const values: string[] = [];
    for (const char of text) {
      this.pending += char;
      const value = this.consume(char);
      if (value !== undefined) {
        values.push(value);
      }
    }
    return values;
  }

  finish(): string[] {
    const tail = this.pending.trim();
    if (tail === "" || tail === "]") {
      return [];
    }
    throw new ImportParseError("The JSON array ended before the last value.");
  }

  private consume(char: string): string | undefined {
    if (this.inString) {
      if (this.escaped) {
        this.escaped = false;
        return undefined;
      }
      if (char === "\\") {
        this.escaped = true;
        return undefined;
      }
      if (char === '"') {
        this.inString = false;
      }
      return undefined;
    }
    if (!this.started) {
      if (char.trim() === "") {
        return undefined;
      }
      if (char !== "[") {
        throw new ImportParseError("A JSON import must be an array.");
      }
      this.started = true;
      return undefined;
    }
    if (this.depth === 0 && (char.trim() === "" || char === "," || char === "]")) {
      if (this.valueStart >= 0 && (char === "," || char === "]")) {
        const value = this.pending.slice(this.valueStart, -1).trim();
        this.valueStart = -1;
        this.pending = "";
        return value.length === 0 ? undefined : value;
      }
      return undefined;
    }
    if (this.valueStart < 0 && char.trim() !== "") {
      this.valueStart = this.pending.length - 1;
    }
    if (char === '"') {
      this.inString = true;
      return undefined;
    }
    if (char === "{" || char === "[") {
      this.depth += 1;
      return undefined;
    }
    if (char === "}" || char === "]") {
      this.depth -= 1;
    }
    return undefined;
  }
}

export function itemFromText(text: string): TypedItem {
  let parsed: unknown;
  try {
    parsed = parsePlain(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new ImportParseError(message);
  }
  if (looksTyped(parsed)) {
    const typed = Item.safeParse(parsed);
    if (typed.success) {
      return typed.data;
    }
  }
  try {
    return fromPlainItem(parsed);
  } catch (error) {
    if (error instanceof PlainJsonError) {
      throw new ImportParseError(error.message);
    }
    throw new ImportParseError("This row is not an item.");
  }
}

export function itemFromCsv(
  cells: readonly string[],
  mapping: CsvMapping,
  headers: readonly string[] | undefined,
): TypedItem {
  const item: TypedItem = {};
  mapping.columns.forEach((column, index) => {
    if (column.type === "skip") {
      return;
    }
    const position = headers === undefined ? index : headers.indexOf(column.name);
    if (position < 0 || cells[position] === undefined) {
      throw new ImportParseError(`Column ${column.name} is missing.`);
    }
    const raw = cells[position];
    const value = cellValue(column.name, column.type, raw);
    if (value !== undefined) {
      item[column.name] = value;
    }
  });
  return item;
}

export function checkImportItem(item: TypedItem, keys: readonly ItemKeySpec[]): string | undefined {
  for (const key of keys) {
    const value = item[key.name];
    if (value === undefined || !(key.type in value) || textOf(value).length === 0) {
      return `Missing key ${key.name}.`;
    }
  }
  if (estimateItemSize(item) > ITEM_SIZE_LIMIT) {
    return "This item is over 400 KB.";
  }
  return undefined;
}

function cellValue(
  name: string,
  type: "S" | "N" | "BOOL" | "JSON",
  raw: string,
): AttributeValue | undefined {
  if (type === "S") {
    return { S: raw };
  }
  if (type === "N") {
    if (!isDynamoNumber(raw)) {
      throw new ImportParseError(`${name} is not a DynamoDB number.`);
    }
    return { N: raw };
  }
  if (type === "BOOL") {
    const normalized = raw.trim().toLowerCase();
    if (normalized !== "true" && normalized !== "false") {
      throw new ImportParseError(`${name} must be true or false.`);
    }
    return { BOOL: normalized === "true" };
  }
  try {
    return fromPlain(parsePlain(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : `${name} is not JSON.`;
    throw new ImportParseError(message);
  }
}

function textOf(value: AttributeValue): string {
  if ("S" in value) {
    return value.S;
  }
  if ("N" in value) {
    return value.N;
  }
  if ("B" in value) {
    return value.B;
  }
  return "x";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksTyped(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const entries = Object.values(value);
  if (entries.length === 0) {
    return false;
  }
  return entries.every((entry) => {
    if (!isRecord(entry)) {
      return false;
    }
    const names = Object.keys(entry);
    const only = names[0];
    return names.length === 1 && only !== undefined && ATTRIBUTE_KEYS.has(only);
  });
}
