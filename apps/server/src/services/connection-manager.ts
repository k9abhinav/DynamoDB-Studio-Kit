import { randomUUID } from "node:crypto";
import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import {
  MAX_CONNECTIONS_PER_SESSION,
  interpretEndpoint,
  type ActiveConnection,
  type Auth,
  type ConnectionHeartbeat,
  type ConnectionSummary,
  type CreateConnectionBody,
  type EnvTag,
  type PatchConnectionBody,
  type TestConnectionBody,
} from "@dynamo-studio/shared";
import { mapDynamoError } from "../dynamo/error-mapper.js";
import { HttpError } from "../http-error.js";
import { createDynamoClient, type DynamoCaller } from "./credentials.js";

interface StoredConnection {
  id: string;
  summary: ConnectionSummary;
  client: DynamoCaller;
}

export interface ConnectionManager {
  test(body: TestConnectionBody): Promise<{ latencyMs: number; tableCountSample: number }>;
  create(sessionId: string, body: CreateConnectionBody): Promise<ActiveConnection>;
  list(sessionId: string): ActiveConnection[];
  heartbeat(sessionId: string, connectionId: string): Promise<ConnectionHeartbeat>;
  patch(sessionId: string, connectionId: string, body: PatchConnectionBody): ActiveConnection;
  remove(sessionId: string, connectionId: string): void;
  assertWritable(sessionId: string, connectionId: string): void;
  destroySession(sessionId: string): void;
}

function normalized(endpoint: string | undefined): { endpoint: string } {
  const interpreted = interpretEndpoint(endpoint ?? "");
  if (interpreted.error !== undefined) {
    throw new HttpError("VALIDATION", interpreted.error);
  }
  return { endpoint: interpreted.endpoint ?? "" };
}

function displayName(name: string | undefined, endpoint: string, region: string): string {
  if (name !== undefined) {
    return name;
  }
  if (endpoint.length === 0) {
    return `AWS ${region}`;
  }
  return new URL(endpoint).host;
}

async function probe(
  client: DynamoCaller,
  endpoint: string,
): Promise<{ latencyMs: number; tableCountSample: number }> {
  const started = Date.now();
  try {
    const result = await client.send(new ListTablesCommand({ Limit: 1 }), {
      abortSignal: AbortSignal.timeout(3_000),
    });
    return {
      latencyMs: Math.max(0, Date.now() - started),
      tableCountSample: Math.min(result.TableNames?.length ?? 0, 1),
    };
  } catch (error) {
    const mapped = mapDynamoError(error, endpoint.length === 0 ? undefined : endpoint);
    throw new HttpError(mapped.code, mapped.message, {
      retryable: mapped.retryable,
      ...(mapped.details === undefined ? {} : { details: mapped.details }),
    });
  }
}

function summaryFor(input: {
  name?: string;
  endpoint: string;
  region: string;
  env: EnvTag;
  readOnly: boolean;
  auth: Auth;
}): ConnectionSummary {
  return {
    name: displayName(input.name, input.endpoint, input.region),
    endpoint: input.endpoint,
    region: input.region,
    env: input.env,
    readOnly: input.readOnly,
    authType: input.auth.type,
  };
}

export function createConnectionManager(options?: {
  createClient?: (input: { region: string; endpoint: string; auth: Auth }) => DynamoCaller;
}): ConnectionManager {
  const openClient = options?.createClient ?? createDynamoClient;
  const sessions = new Map<string, Map<string, StoredConnection>>();

  function bucket(sessionId: string): Map<string, StoredConnection> {
    const existing = sessions.get(sessionId);
    if (existing !== undefined) {
      return existing;
    }
    const created = new Map<string, StoredConnection>();
    sessions.set(sessionId, created);
    return created;
  }

  function requireConnection(sessionId: string, connectionId: string): StoredConnection {
    const connection = sessions.get(sessionId)?.get(connectionId);
    if (connection === undefined) {
      throw new HttpError("NOT_FOUND", "That connection is not in this session.");
    }
    return connection;
  }

  return {
    async test(body) {
      const { endpoint } = normalized(body.endpoint);
      const client = openClient({ region: body.region, endpoint, auth: body.auth });
      try {
        return await probe(client, endpoint);
      } finally {
        client.destroy();
      }
    },
    async create(sessionId, body) {
      const connections = bucket(sessionId);
      if (connections.size >= MAX_CONNECTIONS_PER_SESSION) {
        throw new HttpError(
          "LIMIT_EXCEEDED",
          `This session already has ${String(MAX_CONNECTIONS_PER_SESSION)} connections. Disconnect one first.`,
        );
      }
      const { endpoint } = normalized(body.endpoint);
      const client = openClient({ region: body.region, endpoint, auth: body.auth });
      try {
        await probe(client, endpoint);
      } catch (error) {
        client.destroy();
        throw error;
      }
      const stored: StoredConnection = {
        id: randomUUID(),
        summary: summaryFor({
          endpoint,
          region: body.region,
          env: body.env,
          readOnly: body.readOnly,
          auth: body.auth,
          ...(body.name === undefined ? {} : { name: body.name }),
        }),
        client,
      };
      connections.set(stored.id, stored);
      return { connectionId: stored.id, summary: stored.summary };
    },
    list(sessionId) {
      return [...(sessions.get(sessionId)?.values() ?? [])].map((connection) => ({
        connectionId: connection.id,
        summary: connection.summary,
      }));
    },
    async heartbeat(sessionId, connectionId) {
      const connection = requireConnection(sessionId, connectionId);
      const result = await probe(connection.client, connection.summary.endpoint);
      return { summary: connection.summary, latencyMs: result.latencyMs };
    },
    patch(sessionId, connectionId, body) {
      const connection = requireConnection(sessionId, connectionId);
      if (body.name !== undefined) {
        connection.summary.name = body.name;
      }
      if (body.env !== undefined) {
        connection.summary.env = body.env;
      }
      if (body.readOnly !== undefined) {
        connection.summary.readOnly = body.readOnly;
      }
      return { connectionId: connection.id, summary: connection.summary };
    },
    remove(sessionId, connectionId) {
      const connection = requireConnection(sessionId, connectionId);
      connection.client.destroy();
      sessions.get(sessionId)?.delete(connectionId);
    },
    assertWritable(sessionId, connectionId) {
      const connection = requireConnection(sessionId, connectionId);
      if (connection.summary.readOnly) {
        throw new HttpError("READ_ONLY", "This connection is read-only.");
      }
    },
    destroySession(sessionId) {
      const connections = sessions.get(sessionId);
      if (connections === undefined) {
        return;
      }
      for (const connection of connections.values()) {
        connection.client.destroy();
      }
      sessions.delete(sessionId);
    },
  };
}
