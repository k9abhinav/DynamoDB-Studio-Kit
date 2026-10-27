import {
  canonicalTypedJson,
  stringifyPlain,
  toPlain,
  toPlainItem,
  type AttributeValue,
  type Item,
} from "@dynamo-studio/shared";

export interface ExportCounts {
  items: number;
  bytes: number;
}

export interface ItemEncoder {
  item(item: Item): string;
  finish(counts: ExportCounts): string;
  readonly warnings: readonly string[];
}

function csvEscape(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function isNested(value: AttributeValue): boolean {
  return (
    "M" in value || "L" in value || "SS" in value || "NS" in value || "BS" in value || "B" in value
  );
}

function plainCell(value: AttributeValue): string {
  if ("S" in value) {
    return value.S;
  }
  if ("N" in value) {
    return value.N;
  }
  if ("BOOL" in value) {
    return value.BOOL ? "true" : "false";
  }
  if ("NULL" in value) {
    return "";
  }
  return stringifyPlain(toPlain(value));
}

function typedAttribute(value: AttributeValue): string {
  return canonicalTypedJson({ value }).slice('{"value":'.length, -1);
}

export function createItemEncoder(format: "ndjson" | "json" | "csv", typed: boolean): ItemEncoder {
  const warnings: string[] = [];
  let started = false;
  let columns: string[] | undefined;
  let warnedNested = false;
  let warnedExtra = false;

  function noteNested(): void {
    if (warnedNested) {
      return;
    }
    warnedNested = true;
    warnings.push("Nested values were written as JSON strings.");
  }

  function cell(value: AttributeValue): string {
    if (isNested(value)) {
      noteNested();
    }
    return typed ? typedAttribute(value) : plainCell(value);
  }

  function jsonItem(item: Item): string {
    return typed ? canonicalTypedJson(item) : stringifyPlain(toPlainItem(item));
  }

  function csvItem(item: Item): string {
    if (columns === undefined) {
      columns = [...Object.keys(item)].sort((left, right) => left.localeCompare(right));
      columns.push("_extra");
    }
    const extras: Record<string, string> = {};
    const known = new Set(columns);
    for (const [key, value] of Object.entries(item)) {
      if (!known.has(key)) {
        extras[key] = cell(value);
      }
    }
    if (Object.keys(extras).length > 0 && !warnedExtra) {
      warnedExtra = true;
      warnings.push("Columns that were not in the first row are in _extra.");
    }
    const row = columns.map((column) => {
      if (column === "_extra") {
        return Object.keys(extras).length === 0 ? "" : csvEscape(JSON.stringify(extras));
      }
      const value = item[column];
      return value === undefined ? "" : csvEscape(cell(value));
    });
    const header = started ? "" : `${columns.map((column) => csvEscape(column)).join(",")}\n`;
    started = true;
    return `${header}${row.join(",")}\n`;
  }

  return {
    warnings,
    item(item) {
      if (format === "csv") {
        return csvItem(item);
      }
      const json = jsonItem(item);
      if (format === "ndjson") {
        started = true;
        return `${json}\n`;
      }
      const prefix = started ? ",\n" : "[\n";
      started = true;
      return `${prefix}${json}`;
    },
    finish(counts) {
      if (format === "ndjson") {
        return `${JSON.stringify({ __summary: counts })}\n`;
      }
      if (format === "json") {
        return started ? "\n]\n" : "[]\n";
      }
      return "";
    },
  };
}
