import {
  DeleteItemCommand,
  DeleteTableCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import { createLocalClient } from "./seed-data.js";

export function uniqueToken(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

export async function deleteLocalItems(table: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const client = createLocalClient();
  try {
    for (const id of ids) {
      await client.send(new DeleteItemCommand({ TableName: table, Key: { id: { S: id } } }));
    }
  } finally {
    client.destroy();
  }
}

export async function deleteLocalTables(names: readonly string[]): Promise<void> {
  if (names.length === 0) {
    return;
  }
  const client = createLocalClient();
  try {
    for (const name of names) {
      try {
        await client.send(new DeleteTableCommand({ TableName: name }));
      } catch (error) {
        if (!(error instanceof ResourceNotFoundException)) {
          throw error;
        }
      }
    }
  } finally {
    client.destroy();
  }
}
