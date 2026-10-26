import { isDynamoNumber, type AttributeValue } from "./api/attribute.js";

const KEY_OPS = ["=", "<", "<=", ">", ">=", "between", "begins_with"] as const;

export type KeyOp = (typeof KEY_OPS)[number];

export interface KeyAttribute {
  readonly name: string;
  readonly value: AttributeValue;
}

export interface KeySort {
  readonly name: string;
  readonly op: KeyOp;
  readonly value: AttributeValue;
  readonly value2?: AttributeValue;
}

export interface BuiltKeyCondition {
  readonly expression: string;
  readonly names: Readonly<Record<string, string>>;
  readonly values: Readonly<Record<string, AttributeValue>>;
}

export class QueryRequestError extends Error {
  override readonly name = "QueryRequestError";
}

type ScalarKey = { readonly S: string } | { readonly N: string } | { readonly B: string };

const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Partition key equality plus an optional sort-key condition. Names and values are placeholders. */
export function buildKeyCondition(input: {
  readonly partitionKey: KeyAttribute;
  readonly sortKey?: KeySort;
}): BuiltKeyCondition {
  const names: Record<string, string> = {};
  const values: Record<string, AttributeValue> = {};
  const partition = alias(names, requireName(input.partitionKey.name, "partition key"));
  const partitionValue = placeholder(
    values,
    scalarKey(input.partitionKey.value, "The partition key"),
  );
  let expression = `${partition} = ${partitionValue}`;
  if (input.sortKey !== undefined) {
    expression = `${expression} AND ${sortClause(names, values, input.partitionKey.name, input.sortKey)}`;
  }
  return { expression, names, values };
}

function sortClause(
  names: Record<string, string>,
  values: Record<string, AttributeValue>,
  partitionName: string,
  sort: KeySort,
): string {
  if (sort.name === partitionName) {
    throw new QueryRequestError("The sort key must be a different attribute.");
  }
  const name = alias(names, requireName(sort.name, "sort key"));
  const value = scalarKey(sort.value, "The sort key");
  if (sort.op === "between") {
    if (sort.value2 === undefined) {
      throw new QueryRequestError("Between needs two values.");
    }
    const right = scalarKey(sort.value2, "The sort key");
    if (tag(value) !== tag(right)) {
      throw new QueryRequestError("Between values must be the same type.");
    }
    return `${name} BETWEEN ${placeholder(values, value)} AND ${placeholder(values, right)}`;
  }
  if (sort.value2 !== undefined) {
    throw new QueryRequestError("This condition takes one value.");
  }
  if (sort.op === "begins_with") {
    if (tag(value) === "N") {
      throw new QueryRequestError("begins_with works on strings and binary, not numbers.");
    }
    return `begins_with(${name}, ${placeholder(values, value)})`;
  }
  return `${name} ${sort.op} ${placeholder(values, value)}`;
}

function requireName(name: string, label: string): string {
  if (name.length === 0) {
    throw new QueryRequestError(`The ${label} name cannot be empty.`);
  }
  if (name.length > 255) {
    throw new QueryRequestError(`The ${label} name can be at most 255 characters.`);
  }
  return name;
}

function scalarKey(value: AttributeValue, label: string): ScalarKey {
  if ("S" in value) {
    if (value.S.length === 0) {
      throw new QueryRequestError(`${label} cannot be empty.`);
    }
    return { S: value.S };
  }
  if ("N" in value) {
    if (!isDynamoNumber(value.N)) {
      throw new QueryRequestError(`${label} must be a DynamoDB number.`);
    }
    return { N: value.N };
  }
  if ("B" in value) {
    if (value.B.length === 0 || !base64.test(value.B)) {
      throw new QueryRequestError(`${label} must be base64 binary.`);
    }
    return { B: value.B };
  }
  throw new QueryRequestError(`${label} must be a string, number, or binary.`);
}

function tag(value: ScalarKey): "S" | "N" | "B" {
  if ("S" in value) {
    return "S";
  }
  if ("N" in value) {
    return "N";
  }
  return "B";
}

function alias(names: Record<string, string>, name: string): string {
  const id = `#n${String(Object.keys(names).length)}`;
  names[id] = name;
  return id;
}

function placeholder(values: Record<string, AttributeValue>, value: ScalarKey): string {
  const id = `:v${String(Object.keys(values).length)}`;
  values[id] = value;
  return id;
}

export function isKeyOp(value: string): value is KeyOp {
  return KEY_OPS.some((op) => op === value);
}
