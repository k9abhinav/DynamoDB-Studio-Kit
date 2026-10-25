import { isLosslessNumber, LosslessNumber, parse, stringify } from "lossless-json";
import type { AttributeValue, Item } from "./api/attribute.js";

const WRAPPER_KEYS = new Set(["$b", "$bs", "$ns", "$ss"]);

export class PlainJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlainJsonError";
  }
}

/** Project one attribute into Plain JSON. Numbers stay `LosslessNumber`s. */
export function toPlain(value: AttributeValue): unknown {
  if ("S" in value) {
    return value.S;
  }
  if ("N" in value) {
    return new LosslessNumber(value.N);
  }
  if ("BOOL" in value) {
    return value.BOOL;
  }
  if ("NULL" in value) {
    return null;
  }
  if ("B" in value) {
    return { $b: value.B };
  }
  if ("SS" in value) {
    return { $ss: [...value.SS] };
  }
  if ("NS" in value) {
    return { $ns: [...value.NS] };
  }
  if ("BS" in value) {
    return { $bs: [...value.BS] };
  }
  if ("L" in value) {
    return value.L.map((child) => toPlain(child));
  }
  return plainMap(value.M);
}

export function toPlainItem(item: Item): Record<string, unknown> {
  return plainMap(item);
}

/** Restore one attribute from Plain JSON. A JavaScript number is rejected. */
export function fromPlain(value: unknown): AttributeValue {
  if (value === null) {
    return { NULL: true };
  }
  if (typeof value === "boolean") {
    return { BOOL: value };
  }
  if (typeof value === "string") {
    return { S: value };
  }
  if (isLosslessNumber(value)) {
    return { N: value.toString() };
  }
  if (typeof value === "number") {
    throw new PlainJsonError("Numbers must stay decimal strings.");
  }
  if (Array.isArray(value)) {
    return { L: value.map((child) => fromPlain(child)) };
  }
  if (!isRecord(value)) {
    throw new PlainJsonError("This value is not plain JSON.");
  }
  const keys = Object.keys(value);
  const only = keys[0];
  if (keys.length === 1 && only !== undefined && WRAPPER_KEYS.has(only)) {
    return fromWrapper(only, value[only]);
  }
  const map: Record<string, AttributeValue> = {};
  for (const key of keys) {
    map[unescapeMapKey(key)] = fromPlain(value[key]);
  }
  return { M: map };
}

export function fromPlainItem(value: unknown): Item {
  if (!isRecord(value)) {
    throw new PlainJsonError("An item must be a JSON object.");
  }
  const item: Record<string, AttributeValue> = {};
  for (const key of Object.keys(value)) {
    const name = unescapeMapKey(key);
    if (name.length === 0 || name.length > 255) {
      throw new PlainJsonError("Attribute names must be 1 to 255 characters.");
    }
    item[name] = fromPlain(value[key]);
  }
  return item;
}

export function stringifyPlain(value: unknown): string {
  const text = stringify(value);
  if (text === undefined) {
    throw new PlainJsonError("Could not format this JSON.");
  }
  return text;
}

export function parsePlain(text: string): unknown {
  return parse(text);
}

/** Stable typed JSON: map keys sorted, arrays and number text unchanged. */
export function canonicalTypedJson(item: Item): string {
  return JSON.stringify(canonicalMap(item));
}

function plainMap(map: Readonly<Record<string, AttributeValue>>): Record<string, unknown> {
  const plain: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(map)) {
    plain[escapeMapKey(key)] = toPlain(child);
  }
  return plain;
}

function escapeMapKey(key: string): string {
  if (WRAPPER_KEYS.has(key) || key.startsWith("$$")) {
    return `$${key}`;
  }
  return key;
}

function unescapeMapKey(key: string): string {
  return key.startsWith("$$") ? key.slice(1) : key;
}

function fromWrapper(key: string, value: unknown): AttributeValue {
  if (key === "$b") {
    if (typeof value !== "string") {
      throw new PlainJsonError("Binary must be a base64 string.");
    }
    return { B: value };
  }
  if (!Array.isArray(value)) {
    throw new PlainJsonError("A set must be a list.");
  }
  if (key === "$ss" && isStringList(value)) {
    return { SS: value };
  }
  if (key === "$bs" && isStringList(value)) {
    return { BS: value };
  }
  if (key === "$ns") {
    return { NS: value.map((entry) => numberText(entry)) };
  }
  throw new PlainJsonError("A set must contain strings.");
}

function numberText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (isLosslessNumber(value)) {
    return value.toString();
  }
  throw new PlainJsonError("A number set member must be a decimal string.");
}

function isStringList(value: readonly unknown[]): value is string[] {
  return value.every((entry) => typeof entry === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) && !isLosslessNumber(value)
  );
}

function canonicalMap(map: Readonly<Record<string, AttributeValue>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(map).sort()) {
    const child = map[key];
    if (child !== undefined) {
      out[key] = canonicalValue(child);
    }
  }
  return out;
}

function canonicalValue(value: AttributeValue): unknown {
  if ("L" in value) {
    return { L: value.L.map((child) => canonicalValue(child)) };
  }
  if ("M" in value) {
    return { M: canonicalMap(value.M) };
  }
  if ("SS" in value) {
    return { SS: [...value.SS] };
  }
  if ("NS" in value) {
    return { NS: [...value.NS] };
  }
  if ("BS" in value) {
    return { BS: [...value.BS] };
  }
  return value;
}
