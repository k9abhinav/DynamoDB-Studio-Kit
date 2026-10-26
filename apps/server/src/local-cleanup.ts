import {
  DeleteItemCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";

export function uniqueToken(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

function localClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: "us-east-1",
    endpoint: process.env.DYNAMO_ENDPOINT ?? "http://127.0.0.1:8000",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
}

export async function deleteLocalItems(table: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const client = localClient();
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
  const client = localClient();
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
