import { z } from "zod";

const trimmed = z.string().trim().min(1);

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? undefined : trimmedValue;
}

export const LocalAuth = z.strictObject({
  type: z.literal("local"),
});

export const KeysAuth = z.strictObject({
  type: z.literal("keys"),
  accessKeyId: trimmed,
  secretAccessKey: trimmed,
  sessionToken: z.preprocess(blankToUndefined, z.string().min(1).optional()),
});

export const ProfileAuth = z.strictObject({
  type: z.literal("profile"),
  profile: trimmed,
});

export const DefaultChainAuth = z.strictObject({
  type: z.literal("default-chain"),
});

export const Auth = z.discriminatedUnion("type", [
  LocalAuth,
  KeysAuth,
  ProfileAuth,
  DefaultChainAuth,
]);

export type Auth = z.infer<typeof Auth>;

export const AuthType = z.enum(["local", "keys", "profile", "default-chain"]);

export type AuthType = z.infer<typeof AuthType>;

export const EnvTag = z.enum(["local", "dev", "staging", "production"]);

export type EnvTag = z.infer<typeof EnvTag>;
