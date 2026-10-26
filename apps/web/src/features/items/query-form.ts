import {
  QueryRequestError,
  buildKeyCondition,
  isDynamoNumber,
  type AttributeValue,
  type Filter,
  type KeyOp,
  type QueryPreview,
} from "@dynamo-studio/shared";
import { shellQuote } from "./copy-command.js";

export const QUERY_NEEDS_PARTITION =
  "Query needs a partition key value. Use Scan to browse without one.";

export interface QueryKeyField {
  readonly name: string;
  readonly type: "S" | "N" | "B";
}

export interface QueryTarget {
  readonly label: string;
  readonly index?: string;
  readonly kind: "table" | "gsi" | "lsi";
  readonly partition: QueryKeyField;
  readonly sort?: QueryKeyField;
}

export interface QueryDraft {
  readonly partition: string;
  readonly useSort: boolean;
  readonly sortOp: KeyOp;
  readonly sort: string;
  readonly sortTo: string;
  readonly binaryEncoding: "base64" | "hex";
  readonly scanForward: boolean;
  readonly consistentRead: boolean;
  readonly projection: readonly string[];
}

export function emptyQueryDraft(): QueryDraft {
  return {
    partition: "",
    useSort: false,
    sortOp: "=",
    sort: "",
    sortTo: "",
    binaryEncoding: "base64",
    scanForward: true,
    consistentRead: false,
    projection: [],
  };
}

export function queryTargets(description: {
  readonly keySchema: readonly {
    readonly name: string;
    readonly type: "S" | "N" | "B";
    readonly keyType: "HASH" | "RANGE";
  }[];
  readonly gsis: readonly {
    readonly name: string;
    readonly keys: readonly {
      readonly name: string;
      readonly type: "S" | "N" | "B";
      readonly keyType: "HASH" | "RANGE";
    }[];
  }[];
  readonly lsis: readonly {
    readonly name: string;
    readonly keys: readonly {
      readonly name: string;
      readonly type: "S" | "N" | "B";
      readonly keyType: "HASH" | "RANGE";
    }[];
  }[];
}): QueryTarget[] {
  const table = targetFromKeys("Table", "table", description.keySchema);
  const gsis = description.gsis.map((index) =>
    targetFromKeys(index.name, "gsi", index.keys, index.name),
  );
  const lsis = description.lsis.map((index) =>
    targetFromKeys(index.name, "lsi", index.keys, index.name),
  );
  return [table, ...gsis, ...lsis];
}

function targetFromKeys(
  label: string,
  kind: QueryTarget["kind"],
  keys: readonly {
    readonly name: string;
    readonly type: "S" | "N" | "B";
    readonly keyType?: "HASH" | "RANGE";
  }[],
  index?: string,
): QueryTarget {
  const partition = keys.find((key) => key.keyType === "HASH") ?? keys[0];
  const sort = keys.find((key) => key.keyType === "RANGE");
  if (partition === undefined) {
    throw new Error("A query target needs a partition key.");
  }
  return {
    label,
    kind,
    partition: { name: partition.name, type: partition.type },
    ...(sort === undefined ? {} : { sort: { name: sort.name, type: sort.type } }),
    ...(index === undefined ? {} : { index }),
  };
}

export function hexToBase64(value: string): string | undefined {
  const cleaned = value.replaceAll(/\s/g, "");
  if (cleaned.length === 0 || cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/u.test(cleaned)) {
    return undefined;
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(cleaned.slice(index * 2, index * 2 + 2), 16);
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function typedValue(
  field: QueryKeyField,
  text: string,
  encoding: QueryDraft["binaryEncoding"],
): { ok: true; value: AttributeValue } | { ok: false; message: string } {
  if (field.type === "S") {
    if (text.length === 0) {
      return { ok: false, message: "Enter a value." };
    }
    return { ok: true, value: { S: text } };
  }
  if (field.type === "N") {
    if (!isDynamoNumber(text)) {
      return { ok: false, message: "Enter a number, such as 1.50 or 1E+2." };
    }
    return { ok: true, value: { N: text } };
  }
  const binary = encoding === "hex" ? hexToBase64(text) : text.trim();
  if (binary === undefined || binary.length === 0) {
    return { ok: false, message: "Enter binary as base64, or switch to hex." };
  }
  return { ok: true, value: { B: binary } };
}

export function queryFormMessage(target: QueryTarget, draft: QueryDraft): string | undefined {
  if (draft.partition.length === 0) {
    return QUERY_NEEDS_PARTITION;
  }
  const partition = typedValue(target.partition, draft.partition, draft.binaryEncoding);
  if (!partition.ok) {
    return partition.message;
  }
  if (target.sort !== undefined && draft.useSort) {
    const sort = typedValue(target.sort, draft.sort, draft.binaryEncoding);
    if (!sort.ok) {
      return sort.message;
    }
    const end =
      draft.sortOp === "between"
        ? typedValue(target.sort, draft.sortTo, draft.binaryEncoding)
        : undefined;
    if (end !== undefined && !end.ok) {
      return end.message;
    }
    try {
      buildKeyCondition({
        partitionKey: { name: target.partition.name, value: partition.value },
        sortKey: {
          name: target.sort.name,
          op: draft.sortOp,
          value: sort.value,
          ...(end?.ok === true ? { value2: end.value } : {}),
        },
      });
    } catch (error) {
      if (error instanceof QueryRequestError) {
        return error.message;
      }
      throw error;
    }
  }
  return undefined;
}

export function buildQueryBody(input: {
  target: QueryTarget;
  draft: QueryDraft;
  limit: number;
  filters: readonly Filter[];
  filterJoiner: "and" | "or";
}):
  | {
      ok: true;
      body: {
        index?: string;
        key: {
          pk: { name: string; value: AttributeValue };
          sk?: { name: string; op: KeyOp; value: AttributeValue; value2?: AttributeValue };
        };
        scanForward: boolean;
        limit: number;
        filters?: Filter[];
        filterJoiner: "and" | "or";
        projection?: string[];
        consistentRead?: boolean;
        fillPage: true;
      };
    }
  | { ok: false; message: string } {
  const message = queryFormMessage(input.target, input.draft);
  if (message !== undefined) {
    return { ok: false, message };
  }
  const partition = typedValue(
    input.target.partition,
    input.draft.partition,
    input.draft.binaryEncoding,
  );
  if (!partition.ok) {
    return partition;
  }
  const keys = new Set(
    [input.target.partition.name, input.target.sort?.name].filter((name) => name !== undefined),
  );
  if (
    input.filters.some((filter) =>
      keys.has(filter.attribute.split(/[.[]/u, 1)[0] ?? filter.attribute),
    )
  ) {
    return {
      ok: false,
      message: "Query filters cannot use key attributes. Put them in the key condition.",
    };
  }
  let sort: { name: string; op: KeyOp; value: AttributeValue; value2?: AttributeValue } | undefined;
  if (input.target.sort !== undefined && input.draft.useSort) {
    const value = typedValue(input.target.sort, input.draft.sort, input.draft.binaryEncoding);
    if (!value.ok) {
      return value;
    }
    sort = { name: input.target.sort.name, op: input.draft.sortOp, value: value.value };
    if (input.draft.sortOp === "between") {
      const end = typedValue(input.target.sort, input.draft.sortTo, input.draft.binaryEncoding);
      if (!end.ok) {
        return end;
      }
      sort = { ...sort, value2: end.value };
    }
  }
  return {
    ok: true,
    body: {
      key: {
        pk: { name: input.target.partition.name, value: partition.value },
        ...(sort === undefined ? {} : { sk: sort }),
      },
      scanForward: input.draft.scanForward,
      limit: input.limit,
      filterJoiner: input.filterJoiner,
      fillPage: true,
      ...(input.target.index === undefined ? {} : { index: input.target.index }),
      ...(input.filters.length === 0 ? {} : { filters: [...input.filters] }),
      ...(input.draft.projection.length === 0 ? {} : { projection: [...input.draft.projection] }),
      ...(input.draft.consistentRead && input.target.kind !== "gsi"
        ? { consistentRead: true }
        : {}),
    },
  };
}

export function queryPreviewText(preview: QueryPreview): string {
  return JSON.stringify(preview, null, 2);
}

export function awsQueryCommand(input: {
  preview: QueryPreview;
  region: string;
  endpoint: string;
}): string {
  const preview = input.preview;
  const parts = ["aws dynamodb query", `--table-name ${shellQuote(preview.TableName)}`];
  if (preview.IndexName !== undefined) {
    parts.push(`--index-name ${shellQuote(preview.IndexName)}`);
  }
  parts.push(
    `--key-condition-expression ${shellQuote(preview.KeyConditionExpression)}`,
    `--expression-attribute-names ${shellQuote(JSON.stringify(preview.ExpressionAttributeNames))}`,
    `--expression-attribute-values ${shellQuote(JSON.stringify(preview.ExpressionAttributeValues))}`,
  );
  parts.push(preview.ScanIndexForward ? "--scan-index-forward" : "--no-scan-index-forward");
  parts.push(`--limit ${String(preview.Limit)}`);
  if (preview.ProjectionExpression !== undefined) {
    parts.push(`--projection-expression ${shellQuote(preview.ProjectionExpression)}`);
  }
  if (preview.FilterExpression !== undefined) {
    parts.push(`--filter-expression ${shellQuote(preview.FilterExpression)}`);
  }
  if (preview.ConsistentRead === true) {
    parts.push("--consistent-read");
  }
  parts.push(`--region ${shellQuote(input.region)}`);
  try {
    if (!new URL(input.endpoint).hostname.endsWith(".amazonaws.com")) {
      parts.push(`--endpoint-url ${shellQuote(input.endpoint)}`);
    }
  } catch {
    parts.push(`--endpoint-url ${shellQuote(input.endpoint)}`);
  }
  return parts.join(" \\\n  ");
}
