import {
  ATTRIBUTE_TYPE_NAMES,
  FILTER_LIMIT,
  IN_VALUE_LIMIT,
  PROJECTION_LIMIT,
  QueryRequestError,
  buildKeyCondition,
  type AttributeTypeName,
  type AttributeValue,
  type BuiltKeyCondition,
  type Filter,
  type KeyAttribute,
  type KeySort,
} from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";

const MAX_SEGMENT = 255;
const MAX_DEPTH = 32;

export interface BuiltExpression {
  readonly expression: string;
  readonly names: Readonly<Record<string, string>>;
  readonly values: Readonly<Record<string, AttributeValue>>;
}

interface NameSegment {
  kind: "name";
  name: string;
}

interface IndexSegment {
  kind: "index";
  index: string;
}

interface AliasState {
  names: Record<string, string>;
  values: Record<string, AttributeValue>;
  nameIds: Map<string, string>;
  nextName: number;
  nextValue: number;
}

function fail(message: string): never {
  throw new HttpError("VALIDATION", message);
}

function createState(): AliasState {
  return { names: {}, values: {}, nameIds: new Map(), nextName: 0, nextValue: 0 };
}

function finish(expression: string, state: AliasState): BuiltExpression {
  return { expression, names: state.names, values: state.values };
}

/** Split `a.b[0].c` into name segments and list indexes. Dots are path separators. */
function parseAttributePath(path: string): Array<NameSegment | IndexSegment> {
  if (path.length === 0) {
    fail("That attribute path is not valid.");
  }
  const segments: Array<NameSegment | IndexSegment> = [];
  let cursor = 0;
  while (cursor < path.length) {
    if (path.charAt(cursor) === "." || path.charAt(cursor) === "[") {
      fail("That attribute path is not valid.");
    }
    const nameStart = cursor;
    while (cursor < path.length && path.charAt(cursor) !== "." && path.charAt(cursor) !== "[") {
      if (path.charAt(cursor) === "]") {
        fail("That attribute path is not valid.");
      }
      cursor += 1;
    }
    const name = path.slice(nameStart, cursor);
    if (name.length > MAX_SEGMENT) {
      fail("An attribute name can be at most 255 characters.");
    }
    segments.push({ kind: "name", name });
    if (cursor >= path.length) {
      break;
    }
    if (path.charAt(cursor) === ".") {
      cursor += 1;
      if (cursor >= path.length) {
        fail("That attribute path is not valid.");
      }
      continue;
    }
    while (path.charAt(cursor) === "[") {
      cursor += 1;
      const indexStart = cursor;
      while (cursor < path.length && path.charAt(cursor) !== "]") {
        const char = path.charAt(cursor);
        if (char < "0" || char > "9") {
          fail("That attribute path is not valid.");
        }
        cursor += 1;
      }
      if (path.charAt(cursor) !== "]" || cursor === indexStart) {
        fail("That attribute path is not valid.");
      }
      const listIndex = path.slice(indexStart, cursor);
      if (listIndex.length > 1 && listIndex.startsWith("0")) {
        fail("That attribute path is not valid.");
      }
      segments.push({ kind: "index", index: listIndex });
      cursor += 1;
      if (cursor < path.length && path.charAt(cursor) === ".") {
        cursor += 1;
        if (cursor >= path.length) {
          fail("That attribute path is not valid.");
        }
        break;
      }
      if (cursor < path.length && path.charAt(cursor) !== "[") {
        fail("That attribute path is not valid.");
      }
    }
  }
  if (segments.length > MAX_DEPTH) {
    fail("That attribute path is too deep.");
  }
  return segments;
}

function aliasName(name: string, state: AliasState): string {
  const existing = state.nameIds.get(name);
  if (existing !== undefined) {
    return existing;
  }
  const id = `#n${String(state.nextName)}`;
  state.nextName += 1;
  state.nameIds.set(name, id);
  state.names[id] = name;
  return id;
}

function renderPath(path: string, state: AliasState): string {
  const parts = parseAttributePath(path).map((segment) =>
    segment.kind === "index" ? `[${segment.index}]` : aliasName(segment.name, state),
  );
  return parts.join(".").replaceAll(".[", "[");
}

function addValue(state: AliasState, value: AttributeValue): string {
  const id = `:v${String(state.nextValue)}`;
  state.nextValue += 1;
  state.values[id] = value;
  return id;
}

function rejectValues(filter: Filter): void {
  if (filter.value !== undefined || filter.value2 !== undefined || filter.values !== undefined) {
    fail("Exists filters do not take a value.");
  }
}

function oneValue(filter: Filter): AttributeValue {
  if (filter.value === undefined || filter.value2 !== undefined || filter.values !== undefined) {
    fail("This filter needs one value.");
  }
  return filter.value;
}

function isTypeCode(value: AttributeValue): value is { readonly S: AttributeTypeName } {
  return "S" in value && ATTRIBUTE_TYPE_NAMES.some((name) => name === value.S);
}

function compile(filter: Filter, state: AliasState): string {
  const path = renderPath(filter.attribute, state);
  switch (filter.op) {
    case "exists":
      rejectValues(filter);
      return `attribute_exists(${path})`;
    case "not_exists":
      rejectValues(filter);
      return `attribute_not_exists(${path})`;
    case "between": {
      if (
        filter.value === undefined ||
        filter.value2 === undefined ||
        filter.values !== undefined
      ) {
        fail("Between needs two values.");
      }
      return `${path} BETWEEN ${addValue(state, filter.value)} AND ${addValue(state, filter.value2)}`;
    }
    case "in": {
      if (
        filter.value !== undefined ||
        filter.value2 !== undefined ||
        filter.values === undefined ||
        filter.values.length === 0 ||
        filter.values.length > IN_VALUE_LIMIT
      ) {
        fail("In needs 1 to 100 values.");
      }
      const list = filter.values.map((value) => addValue(state, value)).join(", ");
      return `${path} IN (${list})`;
    }
    case "type_is": {
      const value = oneValue(filter);
      if (!isTypeCode(value)) {
        fail("That type name is not a DynamoDB type.");
      }
      return `attribute_type(${path}, ${addValue(state, value)})`;
    }
    case "begins_with":
      return `begins_with(${path}, ${addValue(state, oneValue(filter))})`;
    case "contains":
      return `contains(${path}, ${addValue(state, oneValue(filter))})`;
    case "not_contains":
      return `NOT contains(${path}, ${addValue(state, oneValue(filter))})`;
    case "=":
    case "<>":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return `${path} ${filter.op} ${addValue(state, oneValue(filter))}`;
  }
}

export function buildKeyConditionExpression(input: {
  readonly partitionKey: KeyAttribute;
  readonly sortKey?: KeySort;
}): BuiltKeyCondition {
  try {
    return buildKeyCondition(input);
  } catch (error) {
    if (error instanceof QueryRequestError) {
      throw new HttpError("VALIDATION", error.message);
    }
    throw error;
  }
}

export function buildFilterExpression(
  filters: readonly Filter[],
  joiner: "and" | "or",
): BuiltExpression | undefined {
  if (filters.length === 0) {
    return undefined;
  }
  if (filters.length > FILTER_LIMIT) {
    fail("Use at most 20 filters.");
  }
  const state = createState();
  const predicates = filters.map((filter) => `(${compile(filter, state)})`);
  const glue = joiner === "and" ? " AND " : " OR ";
  return finish(predicates.join(glue), state);
}

export function buildScanExpressions(input: {
  filters: readonly Filter[];
  joiner: "and" | "or";
  projection?: readonly string[];
}): {
  filterExpression?: string;
  projectionExpression?: string;
  names: Record<string, string>;
  values: Record<string, AttributeValue>;
} {
  if (input.filters.length > FILTER_LIMIT) {
    fail("Use at most 20 filters.");
  }
  if (input.projection !== undefined && input.projection.length === 0) {
    fail("Choose at least one attribute.");
  }
  if (input.projection !== undefined && input.projection.length > PROJECTION_LIMIT) {
    fail("Choose at most 1024 attributes.");
  }
  const state = createState();
  const filterExpression =
    input.filters.length === 0
      ? undefined
      : input.filters
          .map((filter) => `(${compile(filter, state)})`)
          .join(input.joiner === "and" ? " AND " : " OR ");
  const projectionExpression =
    input.projection === undefined
      ? undefined
      : input.projection.map((path) => renderPath(path, state)).join(", ");
  return {
    names: state.names,
    values: state.values,
    ...(filterExpression === undefined ? {} : { filterExpression }),
    ...(projectionExpression === undefined ? {} : { projectionExpression }),
  };
}

export function buildProjectionExpression(paths: readonly string[]): BuiltExpression {
  if (paths.length === 0) {
    fail("Choose at least one attribute.");
  }
  if (paths.length > PROJECTION_LIMIT) {
    fail("Choose at most 1024 attributes.");
  }
  const state = createState();
  return finish(paths.map((path) => renderPath(path, state)).join(", "), state);
}
