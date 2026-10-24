import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromIni, fromNodeProviderChain } from "@aws-sdk/credential-providers";
import type { Auth } from "@dynamo-studio/shared";

export interface DynamoCaller {
  destroy(): void;
  send(
    command: { readonly input?: object },
    options?: { abortSignal?: AbortSignal },
  ): Promise<unknown>;
}

export function createDynamoClient(input: {
  region: string;
  endpoint: string;
  auth: Auth;
}): DynamoCaller {
  const client = new DynamoDBClient({
    region: input.region,
    credentials: credentialsFor(input.auth),
    maxAttempts: 1,
    ...(input.endpoint.length === 0 ? {} : { endpoint: input.endpoint }),
  });
  return {
    destroy() {
      client.destroy();
    },
    send(command, options) {
      return client.send(command as Parameters<DynamoDBClient["send"]>[0], options);
    },
  };
}

function credentialsFor(auth: Auth) {
  if (auth.type === "local") {
    return { accessKeyId: "local", secretAccessKey: "local" };
  }
  if (auth.type === "keys") {
    return {
      accessKeyId: auth.accessKeyId,
      secretAccessKey: auth.secretAccessKey,
      ...(auth.sessionToken === undefined ? {} : { sessionToken: auth.sessionToken }),
    };
  }
  if (auth.type === "profile") {
    return fromIni({ profile: auth.profile });
  }
  return fromNodeProviderChain();
}
