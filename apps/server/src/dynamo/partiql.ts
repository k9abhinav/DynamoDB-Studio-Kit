import { ExecuteStatementCommand } from "@aws-sdk/client-dynamodb";
import {
  PARTIQL_STATEMENT_BYTES,
  PartiqlResponse,
  classifyStatement,
  type AttributeValue,
  type PartiqlResponse as PartiqlResponseBody,
  type StatementKind,
} from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import { HttpError } from "../http-error.js";
import { fromSdkItem, toSdkValue } from "./attribute-wire.js";
import { mapDynamoError } from "./error-mapper.js";
import {
  decodePartiqlCursor,
  encodePartiqlCursor,
  type PartiqlCursorContext,
} from "./partiql-cursor.js";
import { partiqlPosition } from "./partiql-position.js";

const FILL_CALLS = 10;
const FILL_MS = 2_000;

export interface PartiqlInput {
  statement: string;
  parameters?: readonly AttributeValue[];
  limit: number;
  cursor?: string;
  consistentRead?: boolean;
  signal?: AbortSignal;
  now?: () => number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function cancelled(): Error {
  const error = new Error("The PartiQL statement was cancelled.");
  error.name = "AbortError";
  return error;
}

function contextOf(input: PartiqlInput): PartiqlCursorContext {
  return {
    statement: input.statement,
    parameters: input.parameters ?? [],
    consistentRead: input.consistentRead === true,
  };
}

function mapped(error: unknown, endpoint: string): HttpError {
  if (error instanceof HttpError) {
    return error;
  }
  const result = mapDynamoError(error, endpoint.length === 0 ? undefined : endpoint);
  const position = result.code === "VALIDATION" ? partiqlPosition(result.message) : undefined;
  const code = result.code === "VALIDATION" ? "PARTIQL_ERROR" : result.code;
  const details = {
    ...(result.details ?? {}),
    ...(position === undefined ? {} : { position }),
  };
  return new HttpError(code, result.message, {
    retryable: result.retryable,
    ...(Object.keys(details).length === 0 ? {} : { details }),
  });
}

export async function executePartiql(
  client: DynamoCaller,
  endpoint: string,
  input: PartiqlInput,
): Promise<PartiqlResponseBody> {
  if (Buffer.byteLength(input.statement, "utf8") > PARTIQL_STATEMENT_BYTES) {
    throw new HttpError("LIMIT_EXCEEDED", "PartiQL statements are limited to 8192 bytes.");
  }
  const kind: StatementKind = classifyStatement(input.statement);
  if (kind === "mutation" && input.cursor !== undefined) {
    throw new HttpError("VALIDATION", "A mutation does not use a cursor.");
  }
  const context = contextOf(input);
  const now = input.now ?? Date.now;
  let token = input.cursor === undefined ? undefined : decodePartiqlCursor(input.cursor, context);
  const started = now();
  const items: Array<Record<string, AttributeValue>> = [];
  let calls = 0;
  while (items.length < input.limit) {
    if (input.signal?.aborted === true) {
      throw cancelled();
    }
    if (calls > 0 && (calls >= FILL_CALLS || now() - started >= FILL_MS)) {
      break;
    }
    const page = await readPage(client, endpoint, input, kind, {
      remaining: input.limit - items.length,
      ...(token === undefined ? {} : { token }),
    });
    calls += 1;
    items.push(...page.items);
    token = page.token;
    if (kind === "mutation" || token === undefined) {
      break;
    }
  }
  const nextCursor =
    token === undefined || kind === "mutation" ? undefined : encodePartiqlCursor(token, context);
  return PartiqlResponse.parse({
    items,
    kind,
    ...(nextCursor === undefined ? {} : { nextCursor }),
  });
}

async function readPage(
  client: DynamoCaller,
  endpoint: string,
  input: PartiqlInput,
  kind: StatementKind,
  page: { remaining: number; token?: string },
): Promise<{ items: Array<Record<string, AttributeValue>>; token?: string }> {
  if (input.signal?.aborted === true) {
    throw cancelled();
  }
  let result: unknown;
  try {
    result = await client.send(
      new ExecuteStatementCommand({
        Statement: input.statement,
        ...(input.parameters === undefined
          ? {}
          : { Parameters: input.parameters.map((value) => toSdkValue(value)) }),
        ...(input.consistentRead === true ? { ConsistentRead: true } : {}),
        ...(page.token === undefined ? {} : { NextToken: page.token }),
        ...(kind === "select" ? { Limit: page.remaining } : {}),
        ReturnConsumedCapacity: "TOTAL",
      }),
      input.signal === undefined ? {} : { abortSignal: input.signal },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw cancelled();
    }
    throw mapped(error, endpoint);
  }
  const record = asRecord(result);
  const rawItems = Array.isArray(record?.Items) ? record.Items : [];
  const next =
    typeof record?.NextToken === "string" && record.NextToken.length > 0
      ? record.NextToken
      : undefined;
  return {
    items: rawItems.map(fromSdkItem),
    ...(next === undefined ? {} : { token: next }),
  };
}
