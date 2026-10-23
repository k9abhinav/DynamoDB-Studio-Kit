import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { HttpError } from "../http-error.js";

export interface CipherPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

export async function openProfileKey(home: string): Promise<{
  encrypt(value: string): CipherPayload;
  decrypt(payload: CipherPayload): string;
}> {
  await mkdir(home, { recursive: true, mode: 0o700 });
  await chmod(home, 0o700);
  const keyPath = join(home, "key");
  const key = await readOrCreateKey(keyPath);
  return {
    encrypt(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      return {
        iv: iv.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
      };
    },
    decrypt(payload) {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64url"));
      decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, "base64url")),
        decipher.final(),
      ]);
      return plain.toString("utf8");
    },
  };
}

async function readOrCreateKey(keyPath: string): Promise<Buffer> {
  try {
    const existing = await readFile(keyPath);
    if (existing.length !== 32) {
      throw new HttpError("INTERNAL", "The profile key file is not usable. It was left unchanged.");
    }
    await chmod(keyPath, 0o600);
    return existing;
  } catch (error) {
    if (error instanceof HttpError || !isEnoent(error)) {
      throw error;
    }
    const key = randomBytes(32);
    const handle = await open(keyPath, "wx", 0o600);
    await handle.writeFile(key);
    await handle.sync();
    await handle.close();
    await chmod(keyPath, 0o600);
    return key;
  }
}

export async function fileMode(path: string): Promise<number> {
  const info = await stat(path);
  return info.mode & 0o777;
}

function isEnoent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
