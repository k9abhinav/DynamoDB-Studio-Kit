import type { Item } from "@dynamo-studio/shared";

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function awsPutItemCommand(input: {
  table: string;
  region: string;
  endpoint: string;
  item: Item;
}): string {
  const parts = [
    "aws dynamodb put-item",
    `--table-name ${shellQuote(input.table)}`,
    `--item ${shellQuote(JSON.stringify(input.item))}`,
    `--region ${shellQuote(input.region)}`,
  ];
  if (!isRegionalAws(input.endpoint)) {
    parts.push(`--endpoint-url ${shellQuote(input.endpoint)}`);
  }
  return parts.join(" \\\n  ");
}

function isRegionalAws(endpoint: string): boolean {
  try {
    return new URL(endpoint).hostname.endsWith(".amazonaws.com");
  } catch {
    return false;
  }
}
