import { TABLE_LIST_MAX_NAMES } from "@dynamo-studio/shared";
import { z } from "zod";
import { HttpError } from "../http-error.js";

export interface TableNamePage {
  names: string[];
  nextStart?: string;
}

const Cursor = z.strictObject({
  v: z.literal(1),
  seen: z.number().int().nonnegative(),
  start: z.string().min(1),
});

function decodeCursor(value: string): { seen: number; start: string } {
  try {
    const parsed = Cursor.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return { seen: parsed.seen, start: parsed.start };
  } catch {
    throw new HttpError("VALIDATION", "That table list cursor is not valid.");
  }
}

function encodeCursor(seen: number, start: string): string {
  return Buffer.from(JSON.stringify({ v: 1, seen, start }), "utf8").toString("base64url");
}

export async function listTableNames(input: {
  limit: number;
  search?: string;
  cursor?: string;
  maxNames?: number;
  signal?: AbortSignal;
  fetchPage: (start: string | undefined, signal?: AbortSignal) => Promise<TableNamePage>;
}): Promise<{ tables: string[]; nextCursor?: string }> {
  const maxNames = input.maxNames ?? TABLE_LIST_MAX_NAMES;
  const query = input.search?.trim().toLowerCase() ?? "";
  const decoded = input.cursor === undefined ? undefined : decodeCursor(input.cursor);
  let seen = decoded?.seen ?? 0;
  let start = decoded?.start;
  if (seen >= maxNames) {
    return { tables: [] };
  }
  const tables: string[] = [];
  let nextCursor: string | undefined;
  while (tables.length < input.limit && seen < maxNames) {
    const page = await input.fetchPage(start, input.signal);
    let filled = false;
    for (let index = 0; index < page.names.length; index += 1) {
      if (seen >= maxNames) {
        filled = true;
        break;
      }
      seen += 1;
      const name = page.names[index];
      if (name === undefined) {
        continue;
      }
      if (query.length === 0 || name.toLowerCase().includes(query)) {
        tables.push(name);
      }
      const lastInPage = index === page.names.length - 1;
      const moreBeyond = !lastInPage || page.nextStart !== undefined;
      if (tables.length === input.limit) {
        if (moreBeyond && seen < maxNames) {
          nextCursor = encodeCursor(seen, name);
        }
        filled = true;
        break;
      }
      if (seen >= maxNames) {
        filled = true;
        break;
      }
    }
    if (filled || page.nextStart === undefined || seen >= maxNames) {
      break;
    }
    start = page.nextStart;
  }
  return nextCursor === undefined ? { tables } : { tables, nextCursor };
}
