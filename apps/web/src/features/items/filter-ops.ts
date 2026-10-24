import {
  ATTRIBUTE_TYPE_NAMES,
  Filter,
  isDynamoNumber,
  type AttributeValue,
  type FilterOp,
} from "@dynamo-studio/shared";

export type ValueKind = "S" | "N" | "B" | "BOOL" | "SET" | "DOC";

const STRING_OPS: readonly FilterOp[] = [
  "=",
  "<>",
  "<",
  "<=",
  ">",
  ">=",
  "between",
  "begins_with",
  "contains",
  "not_contains",
  "in",
  "exists",
  "not_exists",
  "type_is",
];

export function valueKind(value: AttributeValue | undefined): ValueKind {
  if (value !== undefined && "N" in value) {
    return "N";
  }
  if (value !== undefined && "B" in value) {
    return "B";
  }
  if (value !== undefined && "BOOL" in value) {
    return "BOOL";
  }
  if (value !== undefined && ("SS" in value || "NS" in value || "BS" in value)) {
    return "SET";
  }
  if (value !== undefined && ("L" in value || "M" in value || "NULL" in value)) {
    return "DOC";
  }
  return "S";
}

export function operatorsFor(kind: ValueKind): readonly FilterOp[] {
  if (kind === "N") {
    return ["=", "<>", "<", "<=", ">", ">=", "between", "in", "exists", "not_exists", "type_is"];
  }
  if (kind === "B") {
    return ["=", "begins_with"];
  }
  if (kind === "BOOL") {
    return ["="];
  }
  if (kind === "SET") {
    return ["contains"];
  }
  if (kind === "DOC") {
    return ["exists", "not_exists", "type_is"];
  }
  return STRING_OPS;
}

export function compileFilter(input: {
  attribute: string;
  op: FilterOp;
  kind: ValueKind;
  raw: string;
  raw2: string;
}): { ok: true; filter: Filter } | { ok: false; message: string } {
  try {
    const filter = Filter.parse(filterBody(input));
    return { ok: true, filter };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "That filter is not valid.",
    };
  }
}

function filterBody(input: {
  attribute: string;
  op: FilterOp;
  kind: ValueKind;
  raw: string;
  raw2: string;
}): unknown {
  const attribute = input.attribute.trim();
  if (input.op === "exists" || input.op === "not_exists") {
    return { attribute, op: input.op };
  }
  if (input.op === "type_is") {
    return { attribute, op: input.op, value: { S: input.raw.trim() } };
  }
  if (input.op === "between") {
    return {
      attribute,
      op: input.op,
      value: typed(input.kind, input.raw.trim()),
      value2: typed(input.kind, input.raw2.trim()),
    };
  }
  if (input.op === "in") {
    const parts = input.raw
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return { attribute, op: input.op, values: parts.map((part) => typed(input.kind, part)) };
  }
  return { attribute, op: input.op, value: typed(input.kind, input.raw) };
}

function typed(kind: ValueKind, raw: string): AttributeValue {
  if (kind === "N") {
    if (!isDynamoNumber(raw)) {
      throw new Error("Enter the number as a decimal string.");
    }
    return { N: raw };
  }
  if (kind === "BOOL") {
    if (raw !== "true" && raw !== "false") {
      throw new Error("Enter true or false.");
    }
    return { BOOL: raw === "true" };
  }
  if (kind === "B") {
    return { B: raw };
  }
  return { S: raw };
}

export const TYPE_CODES = ATTRIBUTE_TYPE_NAMES;
