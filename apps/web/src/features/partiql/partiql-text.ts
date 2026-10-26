import { isDynamoNumber, type AttributeValue } from "@dynamo-studio/shared";

export interface ParamDraft {
  readonly type: "S" | "N" | "BOOL" | "NULL";
  readonly text: string;
}

export function compileParameters(
  params: readonly ParamDraft[],
): { ok: true; values: AttributeValue[] } | { ok: false; message: string } {
  const values: AttributeValue[] = [];
  for (const param of params) {
    if (param.type === "NULL") {
      values.push({ NULL: true });
      continue;
    }
    if (param.type === "BOOL") {
      values.push({ BOOL: param.text === "true" });
      continue;
    }
    if (param.type === "N") {
      if (!isDynamoNumber(param.text)) {
        return { ok: false, message: "Enter a number, such as 1.50 or 1E+2." };
      }
      values.push({ N: param.text });
      continue;
    }
    values.push({ S: param.text });
  }
  return { ok: true, values };
}

export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function partiqlTemplates(
  table: string,
  partitionKey: string,
): readonly { readonly label: string; readonly statement: string }[] {
  const quoted = quoteIdent(table);
  const key = quoteIdent(partitionKey);
  return [
    { label: "Select all", statement: `SELECT * FROM ${quoted}` },
    { label: "Select by partition key", statement: `SELECT * FROM ${quoted} WHERE ${key} = ?` },
    { label: "Update", statement: `UPDATE ${quoted} SET "name" = ? WHERE ${key} = ?` },
  ];
}

export function visibleTable(statement: string): string | undefined {
  const visible = statement.replaceAll(/--[^\n]*/gu, " ").replaceAll(/\/\*[\s\S]*?\*\//gu, " ");
  const match = /"((?:[^"]|"")*)"/u.exec(visible);
  const name = match?.[1];
  if (name === undefined || name.length === 0) {
    return undefined;
  }
  return name.replaceAll('""', '"');
}

export function isLoopback(endpoint: string): boolean {
  try {
    const host = new URL(endpoint).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}
