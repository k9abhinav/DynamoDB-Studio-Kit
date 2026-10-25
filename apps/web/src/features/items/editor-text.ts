import {
  Item as ItemSchema,
  PlainJsonError,
  estimateItemSize,
  formatPlain,
  fromPlainItem,
  itemHash,
  parsePlain,
  toPlainItem,
  validateTypedItem,
  type Item,
  type ItemKeySpec,
  type ValidateItemOptions,
} from "@dynamo-studio/shared";
import type { EditorIssue } from "./editor-issue.js";

export type JsonMode = "plain" | "typed";

export function formatItem(item: Item, mode: JsonMode): string {
  if (mode === "plain") {
    return formatPlain(toPlainItem(item));
  }
  return JSON.stringify(item, null, 2);
}

export function readEditorDocument(
  text: string,
  mode: JsonMode,
  options: ValidateItemOptions = {},
): { item: Item | null; issues: EditorIssue[]; size: number | null } {
  try {
    const item = mode === "plain" ? fromPlainItem(parsePlain(text)) : typedItem(text);
    const issues = validateTypedItem(item, options).map((issue) => ({
      ...lineOf(text, issue.path),
      message: issue.message,
      severity: issue.severity,
    }));
    const errors = issues.filter((issue) => issue.severity !== "warning");
    return {
      item: errors.length === 0 ? item : null,
      issues,
      size: errors.length === 0 ? byteSize(item) : null,
    };
  } catch (error) {
    const position = positionOf(text, error);
    return {
      item: null,
      issues: [
        {
          ...position,
          message: error instanceof Error ? error.message : "This JSON is not valid.",
          severity: "error",
        },
      ],
      size: null,
    };
  }
}

export async function hashItem(item: Item): Promise<string> {
  return itemHash(item);
}

function typedItem(text: string): Item {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw error instanceof Error ? error : new PlainJsonError("This JSON is not valid.");
  }
  const parsed = ItemSchema.safeParse(value);
  if (!parsed.success) {
    throw new PlainJsonError(parsed.error.issues[0]?.message ?? "This is not a DynamoDB item.");
  }
  return parsed.data;
}

function byteSize(item: Item): number {
  return estimateItemSize(item);
}

function lineOf(text: string, path: string): { line: number; column: number } {
  const name = path.split(".")[0] ?? "";
  if (name.length === 0) {
    return { line: 1, column: 1 };
  }
  const index = text.indexOf(`"${name}"`);
  if (index < 0) {
    return { line: 1, column: 1 };
  }
  return coords(text, index);
}

function positionOf(text: string, error: unknown): { line: number; column: number } {
  const message = error instanceof Error ? error.message : "";
  const match = /position (\d+)/i.exec(message);
  if (match?.[1] === undefined) {
    return { line: 1, column: 1 };
  }
  return coords(text, Number(match[1]));
}

function coords(text: string, index: number): { line: number; column: number } {
  const head = text.slice(0, index);
  const lines = head.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function createTemplate(keys: readonly ItemKeySpec[]): Item {
  const item: Item = {};
  for (const key of keys) {
    item[key.name] = key.type === "N" ? { N: "0" } : key.type === "B" ? { B: "" } : { S: "" };
  }
  return item;
}

export type EditorIssueWithSeverity = EditorIssue & { severity: "error" | "warning" };
