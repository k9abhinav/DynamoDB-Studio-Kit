import { createHash } from "node:crypto";
import { Item, type AttributeValue, type Filter } from "@dynamo-studio/shared";
import { z } from "zod";
import { HttpError } from "../http-error.js";

export interface ScanCursorContext {
  table: string;
  index?: string;
  filters?: readonly Filter[];
  filterJoiner: "and" | "or";
  projection?: readonly string[];
  consistentRead?: boolean;
}

const Cursor = z.strictObject({
  v: z.literal(1),
  lek: Item,
  ctx: z.string().min(1),
});

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (typeof value === "object" && value !== null) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) {
        sorted[key] = stable(entry);
      }
    }
    return sorted;
  }
  return value;
}

export function scanContextHash(context: ScanCursorContext): string {
  const body = {
    table: context.table,
    index: context.index ?? null,
    filters: context.filters ?? [],
    filterJoiner: context.filterJoiner,
    projection: context.projection ?? [],
    consistentRead: context.consistentRead === true,
  };
  return createHash("sha256")
    .update(JSON.stringify(stable(body)))
    .digest("base64url");
}

export function encodeScanCursor(
  lek: Record<string, AttributeValue>,
  context: ScanCursorContext,
): string {
  return Buffer.from(JSON.stringify({ v: 1, lek, ctx: scanContextHash(context) }), "utf8").toString(
    "base64url",
  );
}

export function decodeScanCursor(
  value: string,
  context: ScanCursorContext,
): Record<string, AttributeValue> {
  try {
    const parsed = Cursor.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (parsed.ctx !== scanContextHash(context)) {
      throw new HttpError("VALIDATION", "That scan cursor does not match this request.");
    }
    return parsed.lek;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError("VALIDATION", "That scan cursor is not valid.");
  }
}
