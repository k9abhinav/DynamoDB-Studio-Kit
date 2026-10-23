import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";
import { buildApp } from "../app.js";
import { fileMode } from "./profile-crypto.js";
import { createProfileStore } from "./profile-store.js";

const keys = {
  type: "keys" as const,
  accessKeyId: "AKIAtest",
  secretAccessKey: "super-secret-value",
  sessionToken: "session-token-value",
};

describe("profile store", () => {
  it("encrypts with a unique IV and keeps files at mode 0600", async () => {
    const home = await mkdtemp(join(tmpdir(), "ds-profiles-"));
    const store = createProfileStore(home);
    const draft = {
      name: "Local",
      endpoint: "http://127.0.0.1:8000",
      region: "us-east-1",
      env: "local" as const,
      readOnly: false,
      auth: keys,
    };
    const first = await store.remember(draft);
    await store.remember(draft);
    const raw = await readFile(join(home, "profiles.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      profiles: { secret?: { iv: string; ciphertext: string } }[];
    };
    expect(parsed.profiles[0]?.secret?.iv).not.toBe(parsed.profiles[1]?.secret?.iv);
    expect(parsed.profiles[0]?.secret?.ciphertext).not.toBe(parsed.profiles[1]?.secret?.ciphertext);
    expect(raw).not.toContain("super-secret-value");
    expect(raw).not.toContain("session-token-value");
    expect(await fileMode(join(home, "profiles.json"))).toBe(0o600);
    expect(await fileMode(join(home, "key"))).toBe(0o600);
    expect(await fileMode(home)).toBe(0o700);
    expect((await store.connect(first.id)).auth).toEqual(keys);
  });

  it("refuses a newer profile file without rewriting it", async () => {
    const home = await mkdtemp(join(tmpdir(), "ds-profiles-"));
    await writeFile(join(home, "profiles.json"), JSON.stringify({ version: 2, profiles: [] }));
    const store = createProfileStore(home);
    await expect(store.list()).rejects.toThrow(/newer DynamoDB Studio/);
    expect(JSON.parse(await readFile(join(home, "profiles.json"), "utf8"))).toEqual({
      version: 2,
      profiles: [],
    });
  });

  it("omits secrets from profile responses and skips disk when remember is off", async () => {
    const home = await mkdtemp(join(tmpdir(), "ds-http-profiles-"));
    const app = await buildApp({
      studioHome: home,
      createClient: () => ({
        destroy() {
          return undefined;
        },
        send: () => Promise.resolve({ TableNames: [] }),
      }),
    });
    const session = await app.inject({ method: "GET", url: "/api/v1/session" });
    const cookie = String(session.headers["set-cookie"]).split(";")[0] ?? "";
    const csrf = session.json<{ csrfToken: string }>().csrfToken;
    const headers = { cookie, [CSRF_HEADER]: csrf };
    const forgotten = await app.inject({
      method: "POST",
      url: "/api/v1/connections",
      headers,
      payload: {
        endpoint: "http://127.0.0.1:8000",
        region: "us-east-1",
        auth: keys,
        env: "local",
        readOnly: true,
        remember: false,
      },
    });
    expect(forgotten.statusCode).toBe(201);
    expect(forgotten.body).not.toContain("super-secret-value");
    await expect(readFile(join(home, "profiles.json"))).rejects.toThrow();

    const saved = await app.inject({
      method: "POST",
      url: "/api/v1/connections",
      headers,
      payload: {
        endpoint: "http://127.0.0.1:8000",
        region: "us-east-1",
        auth: keys,
        name: "Saved",
        env: "dev",
        readOnly: false,
        remember: true,
      },
    });
    expect(saved.statusCode).toBe(201);
    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/profiles",
      headers: { cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.body).not.toContain("secretAccessKey");
    expect(listed.body).not.toContain("sessionToken");
    expect(listed.body).not.toContain("super-secret-value");
    expect(listed.json()).toMatchObject([{ name: "Saved", hasSecret: true, authType: "keys" }]);
    await app.close();
  });
});
