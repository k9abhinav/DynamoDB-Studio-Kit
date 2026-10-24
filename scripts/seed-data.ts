import { fileURLToPath } from "node:url";
import {
  BatchWriteItemCommand,
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  ResourceInUseException,
  ScanCommand,
  UpdateTimeToLiveCommand,
  type AttributeValue,
  type WriteRequest,
} from "@aws-sdk/client-dynamodb";

export const LOCAL_ENDPOINT = process.env.DYNAMO_ENDPOINT ?? "http://127.0.0.1:8000";

const THIRTY_EIGHT_DIGIT = "12345678901234567890123456789012345678";
const BLOB_CHARS = 390_000;

export function createLocalClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: "us-east-1",
    endpoint: LOCAL_ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
}

type Item = Record<string, AttributeValue>;

async function ensureTable(
  client: DynamoDBClient,
  input: CreateTableCommand["input"],
): Promise<void> {
  try {
    await client.send(new CreateTableCommand(input));
  } catch (error) {
    if (!(error instanceof ResourceInUseException)) {
      throw error;
    }
  }
  const name = input.TableName;
  if (name === undefined) {
    throw new Error("Table name is required");
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const described = await client.send(new DescribeTableCommand({ TableName: name }));
    const status = described.Table?.TableStatus;
    const indexes = described.Table?.GlobalSecondaryIndexes ?? [];
    const indexesReady = indexes.every((index) => index.IndexStatus === "ACTIVE");
    if (status === "ACTIVE" && indexesReady) {
      return;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${name} to become ACTIVE`);
}

async function writeAll(client: DynamoDBClient, tableName: string, items: Item[]): Promise<void> {
  const chunks: Item[][] = [];
  for (let index = 0; index < items.length; index += 25) {
    chunks.push(items.slice(index, index + 25));
  }
  const queue = [...chunks];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (chunk === undefined) {
        return;
      }
      await writeChunk(client, tableName, chunk);
    }
  });
  await Promise.all(workers);
}

async function writeChunk(client: DynamoDBClient, tableName: string, items: Item[]): Promise<void> {
  let pending: WriteRequest[] = items.map((item) => ({ PutRequest: { Item: item } }));
  for (let attempt = 0; attempt < 8 && pending.length > 0; attempt += 1) {
    const result = await client.send(
      new BatchWriteItemCommand({ RequestItems: { [tableName]: pending } }),
    );
    pending = result.UnprocessedItems?.[tableName] ?? [];
    if (pending.length > 0) {
      await delay(50 * 2 ** attempt);
    }
  }
  if (pending.length > 0) {
    throw new Error(`DynamoDB left ${String(pending.length)} unprocessed items in ${tableName}`);
  }
}

export async function countItems(client: DynamoDBClient, tableName: string): Promise<number> {
  let total = 0;
  let startKey: Record<string, AttributeValue> | undefined;
  do {
    const page = await client.send(
      new ScanCommand({
        TableName: tableName,
        Select: "COUNT",
        ...(startKey === undefined ? {} : { ExclusiveStartKey: startKey }),
      }),
    );
    total += page.Count ?? 0;
    startKey = page.LastEvaluatedKey;
  } while (startKey !== undefined);
  return total;
}

export async function seed(client = createLocalClient()): Promise<void> {
  await ensureTable(client, {
    TableName: "users",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "email-index",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  });
  await ensureTable(client, {
    TableName: "orders",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "S" },
      { AttributeName: "status", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "createdAt", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "status-createdAt-index",
        KeySchema: [
          { AttributeName: "status", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  });
  await ensureTable(client, {
    TableName: "sessions",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  });
  await ensureTable(client, {
    TableName: "edge-cases",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  });

  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: "sessions",
        TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
      }),
    );
  } catch (error) {
    if (!isAlreadyEnabled(error)) {
      throw error;
    }
  }

  const users = Array.from({ length: 1000 }, (_unused, index) => userItem(index + 1));
  const orders = Array.from({ length: 10_000 }, (_unused, index) => orderItem(index));
  await writeAll(client, "users", users);
  await writeAll(client, "orders", orders);
  await writeAll(client, "sessions", sessionItems());
  await writeAll(client, "edge-cases", edgeCaseItems());
}

export async function assertLocalReachable(client = createLocalClient()): Promise<void> {
  const attempts = process.env.CI === "true" ? 40 : 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await client.send(new ListTablesCommand({ Limit: 1 }), {
        abortSignal: AbortSignal.timeout(2000),
      });
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(
    "DynamoDB Local is not running. Start it with `pnpm dev:db`. See the Development section of the README.",
  );
}

function userItem(index: number): Item {
  const id = `user-${index.toString().padStart(4, "0")}`;
  return {
    id: { S: id },
    email: { S: `${id}@example.com` },
    name: { S: `User ${String(index)}` },
  };
}

function orderItem(index: number): Item {
  const userNumber = (index % 100) + 1;
  const created = new Date(Date.UTC(2024, 0, 1, 0, index % 1440, 0)).toISOString();
  const statuses = ["SHIPPED", "PENDING", "CANCELLED"] as const;
  const status = statuses[index % statuses.length] ?? "PENDING";
  return {
    userId: { S: `user-${userNumber.toString().padStart(4, "0")}` },
    createdAt: { S: `${created}#${index.toString().padStart(5, "0")}` },
    status: { S: status },
    orderId: { S: `order-${index.toString().padStart(5, "0")}` },
  };
}

function sessionItems(): Item[] {
  const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
  return Array.from({ length: 5 }, (_unused, index) => ({
    id: { S: `session-${String(index + 1)}` },
    expiresAt: { N: String(expiresAt + index) },
  }));
}

function edgeCaseItems(): Item[] {
  return [
    { id: { S: "number-38" }, digits: { N: THIRTY_EIGHT_DIGIT } },
    { id: { S: "address-pune" }, address: { M: { city: { S: "Pune" } } } },
    {
      id: { S: "sets" },
      labels: { SS: ["alpha", "beta"] },
      scores: { NS: ["1", "2.5"] },
      blobs: { BS: [new Uint8Array(Buffer.from("hi"))] },
    },
    { id: { S: "binary" }, payload: { B: new Uint8Array(Buffer.from("hello")) } },
    { id: { S: "bool" }, active: { BOOL: true } },
    { id: { S: "null" }, note: { NULL: true } },
    { id: { S: "list" }, tags: { L: [{ S: "a" }, { N: "1" }] } },
    { id: { S: "empty-string" }, note: { S: "" } },
    { id: { S: "unicode" }, greeting: { S: "こんにちは 😀" } },
    { id: { S: "large" }, blob: { S: "a".repeat(BLOB_CHARS) } },
  ];
}

function isAlreadyEnabled(error: unknown): boolean {
  return error instanceof Error && /already|enabled/i.test(error.message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const entry = process.argv[1];
if (entry !== undefined && fileURLToPath(import.meta.url) === entry) {
  const client = createLocalClient();
  const started = Date.now();
  try {
    await assertLocalReachable(client);
    await seed(client);
    process.stdout.write(`Seeded DynamoDB Local in ${String(Date.now() - started)}ms\n`);
  } finally {
    client.destroy();
  }
}
