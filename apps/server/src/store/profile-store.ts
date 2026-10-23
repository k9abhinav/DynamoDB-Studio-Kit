import { chmod, open, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Auth,
  EnvTag,
  type Auth as AuthBody,
  type PatchProfileBody,
  type ProfileSummary,
} from "@dynamo-studio/shared";
import { HttpError } from "../http-error.js";
import { openProfileKey } from "./profile-crypto.js";

const SecretRecord = z.strictObject({
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  sessionToken: z.string().min(1).optional(),
});

const StoredProfile = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  endpoint: z.string(),
  region: z.string().min(1),
  env: EnvTag,
  readOnly: z.boolean(),
  authType: z.enum(["local", "keys", "profile", "default-chain"]),
  lastUsedAt: z.iso.datetime(),
  profile: z.string().min(1).optional(),
  secret: z
    .strictObject({
      iv: z.string().min(1),
      tag: z.string().min(1),
      ciphertext: z.string().min(1),
    })
    .optional(),
});

type StoredProfile = z.infer<typeof StoredProfile>;

const ProfileFile = z.strictObject({
  version: z.literal(1),
  profiles: z.array(StoredProfile),
});

export interface ProfileDraft {
  name: string;
  endpoint: string;
  region: string;
  env: ProfileSummary["env"];
  readOnly: boolean;
  auth: AuthBody;
}

export interface ProfileStore {
  list(): Promise<ProfileSummary[]>;
  remember(draft: ProfileDraft): Promise<ProfileSummary>;
  connect(id: string): Promise<ProfileDraft>;
  patch(id: string, body: PatchProfileBody): Promise<ProfileSummary>;
  remove(id: string): Promise<void>;
}

export function createProfileStore(home: string): ProfileStore {
  const filePath = join(home, "profiles.json");

  async function readProfiles(): Promise<StoredProfile[]> {
    let text: string;
    try {
      text = await readFile(filePath, "utf8");
    } catch {
      return [];
    }
    const raw: unknown = JSON.parse(text);
    if (isRecord(raw) && raw.version !== 1) {
      throw new HttpError(
        "VALIDATION",
        "The profile file is from a newer DynamoDB Studio. It was left unchanged.",
      );
    }
    return ProfileFile.parse(raw).profiles;
  }

  async function writeProfiles(profiles: StoredProfile[]): Promise<void> {
    const json = JSON.stringify({ version: 1, profiles });
    const temporary = `${filePath}.tmp`;
    const handle = await open(temporary, "w", 0o600);
    await handle.writeFile(json);
    await handle.sync();
    await handle.close();
    await rename(temporary, filePath);
    await chmod(filePath, 0o600);
  }

  function toSummary(profile: StoredProfile): ProfileSummary {
    return {
      id: profile.id,
      name: profile.name,
      endpoint: profile.endpoint,
      region: profile.region,
      env: profile.env,
      readOnly: profile.readOnly,
      authType: profile.authType,
      lastUsedAt: profile.lastUsedAt,
      hasSecret: profile.secret !== undefined,
      ...(profile.profile === undefined ? {} : { profile: profile.profile }),
    };
  }

  return {
    async list() {
      return (await readProfiles()).map(toSummary);
    },
    async remember(draft) {
      const profiles = await readProfiles();
      const stored = await toStored(home, draft, randomUUID(), new Date().toISOString());
      profiles.push(stored);
      await writeProfiles(profiles);
      return toSummary(stored);
    },
    async connect(id) {
      const profiles = await readProfiles();
      const index = profiles.findIndex((profile) => profile.id === id);
      const current = profiles[index];
      if (current === undefined) {
        throw new HttpError("NOT_FOUND", "That saved connection no longer exists.");
      }
      const auth = await authFromStored(home, current);
      const updated = { ...current, lastUsedAt: new Date().toISOString() };
      profiles[index] = updated;
      await writeProfiles(profiles);
      return draftFrom(updated, auth);
    },
    async patch(id, body) {
      const profiles = await readProfiles();
      const index = profiles.findIndex((profile) => profile.id === id);
      const current = profiles[index];
      if (current === undefined) {
        throw new HttpError("NOT_FOUND", "That saved connection no longer exists.");
      }
      const next = await applyPatch(home, current, body);
      profiles[index] = next;
      await writeProfiles(profiles);
      return toSummary(next);
    },
    async remove(id) {
      const profiles = await readProfiles();
      const next = profiles.filter((profile) => profile.id !== id);
      if (next.length === profiles.length) {
        throw new HttpError("NOT_FOUND", "That saved connection no longer exists.");
      }
      await writeProfiles(next);
    },
  };
}

async function toStored(
  home: string,
  draft: ProfileDraft,
  id: string,
  lastUsedAt: string,
): Promise<StoredProfile> {
  const base = {
    id,
    name: draft.name,
    endpoint: draft.endpoint,
    region: draft.region,
    env: draft.env,
    readOnly: draft.readOnly,
    authType: draft.auth.type,
    lastUsedAt,
    ...(draft.auth.type === "profile" ? { profile: draft.auth.profile } : {}),
  };
  if (draft.auth.type !== "keys") {
    return base;
  }
  const crypto = await openProfileKey(home);
  return {
    ...base,
    secret: crypto.encrypt(JSON.stringify(secretPayload(draft.auth))),
  };
}

function secretPayload(auth: Extract<AuthBody, { type: "keys" }>): z.infer<typeof SecretRecord> {
  return {
    accessKeyId: auth.accessKeyId,
    secretAccessKey: auth.secretAccessKey,
    ...(auth.sessionToken === undefined ? {} : { sessionToken: auth.sessionToken }),
  };
}

async function authFromStored(home: string, profile: StoredProfile): Promise<AuthBody> {
  if (profile.authType === "local") {
    return { type: "local" };
  }
  if (profile.authType === "default-chain") {
    return { type: "default-chain" };
  }
  if (profile.authType === "profile") {
    return { type: "profile", profile: profile.profile ?? "" };
  }
  if (profile.secret === undefined) {
    throw new HttpError("INTERNAL", "The saved access keys are missing.");
  }
  const crypto = await openProfileKey(home);
  return Auth.parse({
    type: "keys",
    ...SecretRecord.parse(JSON.parse(crypto.decrypt(profile.secret))),
  });
}

function draftFrom(profile: StoredProfile, auth: AuthBody): ProfileDraft {
  return {
    name: profile.name,
    endpoint: profile.endpoint,
    region: profile.region,
    env: profile.env,
    readOnly: profile.readOnly,
    auth,
  };
}

async function applyPatch(
  home: string,
  current: StoredProfile,
  body: PatchProfileBody,
): Promise<StoredProfile> {
  const draft = draftFrom(current, await authFromStored(home, current));
  const nextDraft: ProfileDraft = {
    name: body.name ?? draft.name,
    endpoint: body.endpoint ?? draft.endpoint,
    region: body.region ?? draft.region,
    env: body.env ?? draft.env,
    readOnly: body.readOnly ?? draft.readOnly,
    auth: body.auth ?? draft.auth,
  };
  return toStored(home, nextDraft, current.id, current.lastUsedAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
