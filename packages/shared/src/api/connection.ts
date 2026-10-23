import { z } from "zod";
import { Auth, AuthType, EnvTag } from "./auth.js";

const region = z.string().trim().min(1).max(64);
const connectionName = z.string().trim().min(1).max(128);

export const ConnectionSummary = z.strictObject({
  name: connectionName,
  endpoint: z.string(),
  region,
  env: EnvTag,
  readOnly: z.boolean(),
  authType: AuthType,
});

export type ConnectionSummary = z.infer<typeof ConnectionSummary>;

function rejectLocalOnBlankEndpoint(
  value: { endpoint?: string | undefined; auth: { type: string } },
  ctx: z.RefinementCtx,
): void {
  const endpoint = value.endpoint?.trim() ?? "";
  if (endpoint.length === 0 && value.auth.type === "local") {
    ctx.addIssue({
      code: "custom",
      path: ["auth"],
      message: "Local auth needs an endpoint. Use Default credential chain for AWS.",
    });
  }
}

export const TestConnectionBody = z
  .strictObject({
    endpoint: z.string().max(2048).optional(),
    region,
    auth: Auth,
  })
  .superRefine(rejectLocalOnBlankEndpoint);

export type TestConnectionBody = z.infer<typeof TestConnectionBody>;

export const CreateConnectionBody = z
  .strictObject({
    endpoint: z.string().max(2048).optional(),
    region,
    auth: Auth,
    name: connectionName.optional(),
    env: EnvTag,
    readOnly: z.boolean(),
    remember: z.boolean(),
  })
  .superRefine(rejectLocalOnBlankEndpoint);

export type CreateConnectionBody = z.infer<typeof CreateConnectionBody>;

export const TestConnectionResponse = z.strictObject({
  ok: z.literal(true),
  latencyMs: z.number().int().nonnegative(),
  tableCountSample: z.number().int().min(0).max(1),
});

export type TestConnectionResponse = z.infer<typeof TestConnectionResponse>;

export const CreateConnectionResponse = z.strictObject({
  connectionId: z.string().min(1),
  summary: ConnectionSummary,
});

export type CreateConnectionResponse = z.infer<typeof CreateConnectionResponse>;

export const ActiveConnection = z.strictObject({
  connectionId: z.string().min(1),
  summary: ConnectionSummary,
});

export type ActiveConnection = z.infer<typeof ActiveConnection>;

export const ActiveConnectionList = z.array(ActiveConnection);

export const ConnectionHeartbeat = z.strictObject({
  summary: ConnectionSummary,
  latencyMs: z.number().int().nonnegative(),
});

export type ConnectionHeartbeat = z.infer<typeof ConnectionHeartbeat>;

export const PatchConnectionBody = z
  .strictObject({
    name: connectionName.optional(),
    env: EnvTag.optional(),
    readOnly: z.boolean().optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.env !== undefined || value.readOnly !== undefined,
    {
      message: "Provide a name, environment, or read-only flag.",
    },
  );

export type PatchConnectionBody = z.infer<typeof PatchConnectionBody>;
