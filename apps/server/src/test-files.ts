import { mkdir, readFile } from "node:fs/promises";

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readUtf8(path: string): Promise<string> {
  return readFile(path, "utf8");
}
