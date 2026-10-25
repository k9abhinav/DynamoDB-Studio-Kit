import { Item, type AttributeValue, type Item as TypedItem } from "./api/attribute.js";
import { canonicalTypedJson } from "./typed-json.js";

export const ITEM_SIZE_LIMIT = 400 * 1024;
export const ITEM_SIZE_WARN = 350 * 1024;

export interface ItemKeySpec {
  readonly name: string;
  readonly type: "S" | "N" | "B";
}

export interface ItemIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

export interface ValidateItemOptions {
  readonly keys?: readonly ItemKeySpec[];
  readonly original?: TypedItem;
}

const KEY_LABEL = { S: "a string", N: "a number", B: "binary" } as const;

export function estimateItemSize(item: TypedItem): number {
  return Object.entries(item).reduce(
    (sum, [name, value]) => sum + utf8Length(name) + valueSize(value),
    0,
  );
}

export async function itemHash(item: TypedItem): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalTypedJson(item)),
  );
  return base64Url(new Uint8Array(digest));
}

export function extractKey(item: TypedItem, keys: readonly ItemKeySpec[]): TypedItem {
  const key: TypedItem = {};
  for (const attribute of keys) {
    const value = item[attribute.name];
    if (value !== undefined) {
      key[attribute.name] = value;
    }
  }
  return key;
}

export function validateTypedItem(value: unknown, options: ValidateItemOptions = {}): ItemIssue[] {
  const parsed = Item.safeParse(value);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: friendlyIssue(issue),
      severity: "error" as const,
    }));
  }
  const issues: ItemIssue[] = [];
  for (const key of options.keys ?? []) {
    issues.push(...keyIssues(parsed.data, key, options.original));
  }
  const size = estimateItemSize(parsed.data);
  if (size > ITEM_SIZE_LIMIT) {
    issues.push({
      path: "",
      message: `This item is over 400 KB. DynamoDB allows 400 KB.`,
      severity: "error",
    });
  } else if (size >= ITEM_SIZE_WARN) {
    issues.push({
      path: "",
      message: "This item is over 350 KB. The limit is 400 KB.",
      severity: "warning",
    });
  }
  return issues;
}

function keyIssues(
  item: TypedItem,
  key: ItemKeySpec,
  original: TypedItem | undefined,
): ItemIssue[] {
  const value = item[key.name];
  if (value === undefined) {
    return [{ path: key.name, message: `Key ${key.name} is missing.`, severity: "error" }];
  }
  if (!(key.type in value)) {
    return [
      {
        path: key.name,
        message: `Key ${key.name} must be ${KEY_LABEL[key.type]}.`,
        severity: "error",
      },
    ];
  }
  const text = keyText(value);
  if (text !== undefined && text.length === 0) {
    return [{ path: key.name, message: `Key ${key.name} cannot be empty.`, severity: "error" }];
  }
  const previous = original?.[key.name];
  if (previous !== undefined && keyText(previous) !== text) {
    return [{ path: key.name, message: `The key ${key.name} cannot change.`, severity: "error" }];
  }
  return [];
}

function keyText(value: AttributeValue): string | undefined {
  if ("S" in value) {
    return value.S;
  }
  if ("N" in value) {
    return value.N;
  }
  if ("B" in value) {
    return value.B;
  }
  return undefined;
}

function friendlyIssue(issue: { path: readonly PropertyKey[]; message: string }): string {
  const path = issue.path.map(String).join(".");
  if (/unique/i.test(issue.message)) {
    return issue.message;
  }
  if (/(^|\.)(B|BS)(\.|$)/.test(path) && /pattern|base64/i.test(issue.message)) {
    return "Binary values must be base64.";
  }
  if (/number|digit/i.test(issue.message)) {
    return issue.message;
  }
  if (issue.message.includes("32")) {
    return "Items can nest at most 32 levels.";
  }
  if (/\.(SS|NS|BS)$/.test(path) && /at least|too small|min/i.test(issue.message)) {
    return "Sets cannot be empty.";
  }
  return issue.message;
}

function valueSize(value: AttributeValue): number {
  if ("S" in value) {
    return utf8Length(value.S);
  }
  if ("N" in value) {
    return utf8Length(value.N);
  }
  if ("B" in value) {
    return binaryBytes(value.B);
  }
  if ("BOOL" in value || "NULL" in value) {
    return 1;
  }
  if ("SS" in value) {
    return value.SS.reduce((sum, entry) => sum + utf8Length(entry), 0);
  }
  if ("NS" in value) {
    return value.NS.reduce((sum, entry) => sum + utf8Length(entry), 0);
  }
  if ("BS" in value) {
    return value.BS.reduce((sum, entry) => sum + binaryBytes(entry), 0);
  }
  if ("L" in value) {
    return value.L.reduce((sum, entry) => sum + valueSize(entry), 0);
  }
  return Object.entries(value.M).reduce(
    (sum, [name, child]) => sum + utf8Length(name) + valueSize(child),
    0,
  );
}

function binaryBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
