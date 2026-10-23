import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CSRF_HEADER } from "@dynamo-studio/shared";
import { buildApp } from "../app.js";

const endpoint = process.env.DYNAMO_ENDPOINT ?? "http://127.0.0.1:8000";
const previous = {
  shared: process.env.AWS_SHARED_CREDENTIALS_FILE,
  access: process.env.AWS_ACCESS_KEY_ID,
  secret: process.env.AWS_SECRET_ACCESS_KEY,
  metadata: process.env.AWS_EC2_METADATA_DISABLED,
};

afterEach(() => {
  assignEnv("AWS_SHARED_CREDENTIALS_FILE", previous.shared);
  assignEnv("AWS_ACCESS_KEY_ID", previous.access);
  assignEnv("AWS_SECRET_ACCESS_KEY", previous.secret);
  assignEnv("AWS_EC2_METADATA_DISABLED", previous.metadata);
});

function assignEnv(
  name:
    | "AWS_SHARED_CREDENTIALS_FILE"
    | "AWS_ACCESS_KEY_ID"
    | "AWS_SECRET_ACCESS_KEY"
    | "AWS_EC2_METADATA_DISABLED",
  value: string | undefined,
): void {
  if (value === undefined) {
    if (name === "AWS_SHARED_CREDENTIALS_FILE") {
      delete process.env.AWS_SHARED_CREDENTIALS_FILE;
    } else if (name === "AWS_ACCESS_KEY_ID") {
      delete process.env.AWS_ACCESS_KEY_ID;
    } else if (name === "AWS_SECRET_ACCESS_KEY") {
      delete process.env.AWS_SECRET_ACCESS_KEY;
    } else {
      delete process.env.AWS_EC2_METADATA_DISABLED;
    }
    return;
  }
  process.env[name] = value;
}

async function session(app: Awaited<ReturnType<typeof buildApp>>): Promise<{
  cookie: string;
  csrf: string;
}> {
  const response = await app.inject({ method: "GET", url: "/api/v1/session" });
  const header = response.headers["set-cookie"];
  const line = Array.isArray(header) ? header[0] : header;
  if (line === undefined) {
    throw new Error("missing set-cookie");
  }
  return {
    cookie: line.split(";")[0] ?? line,
    csrf: response.json<{ csrfToken: string }>().csrfToken,
  };
}

describe("connection auth against DynamoDB Local", () => {
  it("connects with local, keys, a profile, and the default chain", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ds-profile-"));
    const file = join(directory, "credentials");
    await writeFile(file, "[ci]\naws_access_key_id = local\naws_secret_access_key = local\n");
    process.env.AWS_SHARED_CREDENTIALS_FILE = file;
    process.env.AWS_ACCESS_KEY_ID = "local";
    process.env.AWS_SECRET_ACCESS_KEY = "local";
    process.env.AWS_EC2_METADATA_DISABLED = "true";

    const app = await buildApp();
    const open = await session(app);
    const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
    const auths = [
      { type: "local" },
      {
        type: "keys",
        accessKeyId: "local",
        secretAccessKey: "super-secret-value",
        sessionToken: "session-token-value",
      },
      { type: "profile", profile: "ci" },
      { type: "default-chain" },
    ];
    for (const auth of auths) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/connections",
        headers,
        payload: {
          endpoint,
          region: "us-east-1",
          auth,
          env: "local",
          readOnly: false,
          remember: false,
        },
      });
      expect(response.statusCode, response.body).toBe(201);
      expect(response.body).not.toContain("secretAccessKey");
      expect(response.body).not.toContain("sessionToken");
      expect(response.body).not.toContain("super-secret-value");
      const id = response.json<{ connectionId: string }>().connectionId;
      const beat = await app.inject({
        method: "GET",
        url: `/api/v1/connections/${id}`,
        headers: { cookie: open.cookie },
      });
      expect(beat.statusCode).toBe(200);
      expect(beat.json<{ latencyMs: number }>().latencyMs).toBeGreaterThanOrEqual(0);
      expect(beat.body).not.toContain("super-secret-value");
    }
    await app.close();
  });
});
