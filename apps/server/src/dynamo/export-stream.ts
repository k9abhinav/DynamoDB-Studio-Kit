import { type ExportRequest, type Item, type QueryRequest } from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import { createItemEncoder, type ExportCounts } from "./export-format.js";
import { queryTable } from "./query.js";
import { scanTable } from "./scan.js";

const PAGE = 1000;

export interface ExportPage {
  items: Item[];
  nextCursor?: string;
}

export async function* exportChunks(input: {
  request: ExportRequest;
  signal?: AbortSignal;
  page: (cursor: string | undefined, limit: number) => Promise<ExportPage>;
}): AsyncGenerator<string> {
  const encoder = createItemEncoder(input.request.format, input.request.typed);
  const cap = input.request.maxItems;
  let cursor: string | undefined;
  let items = 0;
  let bytes = 0;
  for (;;) {
    if (input.signal?.aborted === true) {
      return;
    }
    const room = cap === undefined ? PAGE : Math.min(PAGE, cap - items);
    if (room <= 0) {
      break;
    }
    const next = await input.page(cursor, room);
    for (const item of next.items) {
      if (cap !== undefined && items >= cap) {
        break;
      }
      const chunk = encoder.item(item);
      items += 1;
      bytes += Buffer.byteLength(chunk);
      yield chunk;
    }
    if (next.nextCursor === undefined || next.items.length === 0) {
      break;
    }
    if (cap !== undefined && items >= cap) {
      break;
    }
    cursor = next.nextCursor;
  }
  const counts: ExportCounts = { items, bytes };
  yield encoder.finish(counts);
}

export function exportPageLoader(
  client: DynamoCaller,
  endpoint: string,
  table: string,
  request: ExportRequest,
  signal?: AbortSignal,
): (cursor: string | undefined, limit: number) => Promise<ExportPage> {
  return async (cursor, limit) => {
    if (request.scope === "all" || "scan" in request.scope) {
      const scan = request.scope === "all" ? undefined : request.scope.scan;
      const page = await scanTable(client, endpoint, {
        table,
        limit,
        filterJoiner: scan?.filterJoiner ?? "and",
        ...(scan?.index === undefined ? {} : { index: scan.index }),
        ...(scan?.filters === undefined ? {} : { filters: scan.filters }),
        ...(scan?.projection === undefined ? {} : { projection: scan.projection }),
        ...(scan?.consistentRead === undefined ? {} : { consistentRead: scan.consistentRead }),
        ...(scan?.segment === undefined ? {} : { segment: scan.segment }),
        ...(cursor === undefined ? {} : { cursor }),
        ...(signal === undefined ? {} : { signal }),
      });
      return {
        items: page.items,
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      };
    }
    const query = request.scope.query;
    const page = await queryTable(
      client,
      endpoint,
      queryInput(table, query, limit, cursor, signal),
    );
    return {
      items: page.items,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    };
  };
}

function queryInput(
  table: string,
  query: QueryRequest,
  limit: number,
  cursor: string | undefined,
  signal: AbortSignal | undefined,
) {
  return {
    table,
    partitionKey: query.key.pk,
    scanForward: query.scanForward,
    limit,
    filterJoiner: query.filterJoiner,
    ...(query.index === undefined ? {} : { index: query.index }),
    ...(query.key.sk === undefined
      ? {}
      : {
          sortKey: {
            name: query.key.sk.name,
            op: query.key.sk.op,
            value: query.key.sk.value,
            ...(query.key.sk.value2 === undefined ? {} : { value2: query.key.sk.value2 }),
          },
        }),
    ...(query.filters === undefined ? {} : { filters: query.filters }),
    ...(query.projection === undefined ? {} : { projection: query.projection }),
    ...(query.consistentRead === undefined ? {} : { consistentRead: query.consistentRead }),
    ...(cursor === undefined ? {} : { cursor }),
    ...(signal === undefined ? {} : { signal }),
  };
}

export function exportMedia(
  format: ExportRequest["format"],
  table: string,
): {
  type: string;
  filename: string;
} {
  if (format === "csv") {
    return { type: "text/csv; charset=utf-8", filename: `${table}.csv` };
  }
  if (format === "json") {
    return { type: "application/json; charset=utf-8", filename: `${table}.json` };
  }
  return { type: "application/x-ndjson; charset=utf-8", filename: `${table}.ndjson` };
}
