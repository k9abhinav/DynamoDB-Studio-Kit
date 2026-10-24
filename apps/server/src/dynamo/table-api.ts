import {
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";
import { TABLE_LIST_PAGE_MAX, TableDescription, TableWaitResponse } from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import { mapDynamoError } from "./error-mapper.js";
import { HttpError } from "../http-error.js";
import { listTableNames } from "./list-tables.js";
import { normalizeTable } from "./normalize-table.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

async function sendMapped(
  client: DynamoCaller,
  command: { readonly input?: object },
  endpoint: string,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    return await client.send(command, signal === undefined ? {} : { abortSignal: signal });
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    const mapped = mapDynamoError(error, endpoint.length === 0 ? undefined : endpoint);
    throw new HttpError(mapped.code, mapped.message, {
      retryable: mapped.retryable,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
    });
  }
}

function pageFrom(value: unknown): { names: string[]; nextStart?: string } {
  const record = asRecord(value);
  const rawNames = record?.TableNames;
  const names = Array.isArray(rawNames)
    ? rawNames.filter((name): name is string => typeof name === "string")
    : [];
  const next = record?.LastEvaluatedTableName;
  return typeof next === "string" ? { names, nextStart: next } : { names };
}

export async function listConnectionTables(
  client: DynamoCaller,
  endpoint: string,
  input: { limit: number; search?: string; cursor?: string; signal?: AbortSignal },
): Promise<{ tables: string[]; nextCursor?: string }> {
  return listTableNames({
    limit: input.limit,
    ...(input.search === undefined ? {} : { search: input.search }),
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
    fetchPage: async (start, signal) => {
      const result = await sendMapped(
        client,
        new ListTablesCommand({
          Limit: TABLE_LIST_PAGE_MAX,
          ...(start === undefined ? {} : { ExclusiveStartTableName: start }),
        }),
        endpoint,
        signal,
      );
      return pageFrom(result);
    },
  });
}

export async function describeConnectionTable(
  client: DynamoCaller,
  endpoint: string,
  table: string,
  signal?: AbortSignal,
): Promise<ReturnType<typeof TableDescription.parse>> {
  const described = await sendMapped(
    client,
    new DescribeTableCommand({ TableName: table }),
    endpoint,
    signal,
  );
  const rawTable = asRecord(asRecord(described)?.Table);
  const ttlResult = await sendMapped(
    client,
    new DescribeTimeToLiveCommand({ TableName: table }),
    endpoint,
    signal,
  );
  const rawTtl = asRecord(asRecord(ttlResult)?.TimeToLiveDescription);
  if (rawTable === undefined) {
    throw new HttpError("NOT_FOUND", "That table doesn't exist (anymore).");
  }
  return normalizeTable(rawTable, rawTtl ?? {});
}

export async function waitForActiveTable(
  client: DynamoCaller,
  endpoint: string,
  table: string,
  signal?: AbortSignal,
): Promise<ReturnType<typeof TableWaitResponse.parse>> {
  const deadline = Date.now() + 20_000;
  let status = "ACTIVE";
  for (;;) {
    const described = await describeConnectionTable(client, endpoint, table, signal);
    status = described.status;
    if (status === "ACTIVE" || Date.now() >= deadline) {
      return TableWaitResponse.parse({ status });
    }
    await delay(1_000, signal);
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(
        signal?.reason instanceof Error ? signal.reason : new HttpError("VALIDATION", "Cancelled."),
      );
    };
    if (signal?.aborted === true) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
