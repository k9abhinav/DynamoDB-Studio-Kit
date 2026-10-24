import type { AttributeValue } from "@dynamo-studio/shared";

export type SdkAttribute =
  | { S: string }
  | { N: string }
  | { B: Uint8Array }
  | { BOOL: boolean }
  | { NULL: true }
  | { L: SdkAttribute[] }
  | { M: Record<string, SdkAttribute> }
  | { SS: string[] }
  | { NS: string[] }
  | { BS: Uint8Array[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    return undefined;
  }
  return value;
}

function asBytes(value: unknown): Uint8Array | undefined {
  return value instanceof Uint8Array ? value : undefined;
}

export function fromSdkValue(value: unknown): AttributeValue {
  if (!isRecord(value)) {
    throw new Error("DynamoDB returned an attribute value this app cannot read.");
  }
  if (typeof value.S === "string") {
    return { S: value.S };
  }
  if (typeof value.N === "string") {
    return { N: value.N };
  }
  const binary = asBytes(value.B);
  if (binary !== undefined) {
    return { B: Buffer.from(binary).toString("base64") };
  }
  if (typeof value.BOOL === "boolean") {
    return { BOOL: value.BOOL };
  }
  if (value.NULL === true) {
    return { NULL: true };
  }
  if (Array.isArray(value.L)) {
    return { L: value.L.map(fromSdkValue) };
  }
  if (isRecord(value.M)) {
    return { M: fromSdkItem(value.M) };
  }
  const stringSet = strings(value.SS);
  if (stringSet !== undefined) {
    return { SS: stringSet };
  }
  const numberSet = strings(value.NS);
  if (numberSet !== undefined) {
    return { NS: numberSet };
  }
  if (Array.isArray(value.BS) && value.BS.every((entry) => entry instanceof Uint8Array)) {
    return { BS: value.BS.map((entry) => Buffer.from(entry).toString("base64")) };
  }
  throw new Error("DynamoDB returned an attribute value this app cannot read.");
}

export function fromSdkItem(value: unknown): Record<string, AttributeValue> {
  if (!isRecord(value)) {
    return {};
  }
  const item: Record<string, AttributeValue> = {};
  for (const [key, raw] of Object.entries(value)) {
    item[key] = fromSdkValue(raw);
  }
  return item;
}

export function toSdkValue(value: AttributeValue): SdkAttribute {
  if ("S" in value) {
    return { S: value.S };
  }
  if ("N" in value) {
    return { N: value.N };
  }
  if ("B" in value) {
    return { B: Buffer.from(value.B, "base64") };
  }
  if ("BOOL" in value) {
    return { BOOL: value.BOOL };
  }
  if ("NULL" in value) {
    return { NULL: true };
  }
  if ("L" in value) {
    return { L: value.L.map(toSdkValue) };
  }
  if ("M" in value) {
    return { M: toSdkItem(value.M) };
  }
  if ("SS" in value) {
    return { SS: [...value.SS] };
  }
  if ("NS" in value) {
    return { NS: [...value.NS] };
  }
  return { BS: value.BS.map((entry) => Buffer.from(entry, "base64")) };
}

export function toSdkItem(
  item: Readonly<Record<string, AttributeValue>>,
): Record<string, SdkAttribute> {
  const encoded: Record<string, SdkAttribute> = {};
  for (const [key, value] of Object.entries(item)) {
    encoded[key] = toSdkValue(value);
  }
  return encoded;
}
