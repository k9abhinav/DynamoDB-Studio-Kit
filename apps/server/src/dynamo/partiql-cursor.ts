import { createHash } from "node:crypto";
import type { AttributeValue } from "@dynamo-studio/shared";
import { z } from "zod";
import { HttpError } from "../http-error.js";

export interface PartiqlCursorContext {
  statement: string;
  parameters: readonly AttributeValue[];
  consistentRead: boolean;
}

const Cursor = z.strictObject({
  v: z.literal(1),
  token: z.string().min(1),
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

export function partiqlContextHash(context: PartiqlCursorContext): string {
  return createHash("sha256")
    .update(JSON.stringify(stable(context)))
    .digest("base64url");
}

export function encodePartiqlCursor(token: string, context: PartiqlCursorContext): string {
  return Buffer.from(
    JSON.stringify({ v: 1, token, ctx: partiqlContextHash(context) }),
    "utf8",
  ).toString("base64url");
}

export function decodePartiqlCursor(value: string, context: PartiqlCursorContext): string {
  try {
    const parsed = Cursor.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (parsed.ctx !== partiqlContextHash(context)) {
      throw new HttpError("VALIDATION", "That PartiQL cursor does not match this statement.");
    }
    return parsed.token;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError("VALIDATION", "That PartiQL cursor is not valid.");
  }
}
