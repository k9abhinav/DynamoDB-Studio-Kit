import { z } from "zod";
import { Auth, AuthType, EnvTag } from "./auth.js";
import { CreateConnectionResponse } from "./connection.js";

const region = z.string().trim().min(1).max(64);
const connectionName = z.string().trim().min(1).max(128);

export const ProfileSummary = z.strictObject({
  id: z.string().min(1),
  name: connectionName,
  endpoint: z.string(),
  region,
  env: EnvTag,
  readOnly: z.boolean(),
  authType: AuthType,
  lastUsedAt: z.iso.datetime(),
  hasSecret: z.boolean(),
  profile: z.string().min(1).optional(),
});

export type ProfileSummary = z.infer<typeof ProfileSummary>;

export const ProfileList = z.array(ProfileSummary);

export const PatchProfileBody = z
  .strictObject({
    name: connectionName.optional(),
    endpoint: z.string().max(2048).optional(),
    region: region.optional(),
    env: EnvTag.optional(),
    readOnly: z.boolean().optional(),
    auth: Auth.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.endpoint !== undefined ||
      value.region !== undefined ||
      value.env !== undefined ||
      value.readOnly !== undefined ||
      value.auth !== undefined,
    { message: "Provide a field to update." },
  );

export type PatchProfileBody = z.infer<typeof PatchProfileBody>;

export const ProfileConnectResponse = CreateConnectionResponse;
