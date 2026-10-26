import { createHash } from "node:crypto";
import { Item, type AttributeValue, type Filter, type KeySort } from "@dynamo-studio/shared";
import { z } from "zod";
import { HttpError } from "../http-error.js";

export interface QueryCursorContext {
  table: string;
  index?: string;
  partitionKeyName: string;
  partitionKeyValue: AttributeValue;
  sortKey?: KeySort;
  scanForward: boolean;
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

export function queryContextHash(context: QueryCursorContext): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(context)))
    .digest("base64url");
}

export function encodeQueryCursor(
  lek: Record<string, AttributeValue>,
  context: QueryCursorContext,
): string {
  return Buffer.from(
    JSON.stringify({ v: 1, lek, ctx: queryContextHash(context) }),
    "utf8",
  ).toString("base64url");
}

export function decodeQueryCursor(
  value: string,
  context: QueryCursorContext,
): Record<string, AttributeValue> {
  try {
    const parsed = Cursor.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (parsed.ctx !== queryContextHash(context)) {
      throw new HttpError("VALIDATION", "That query cursor does not match this request.");
    }
    return parsed.lek;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError("VALIDATION", "That query cursor is not valid.");
  }
}
