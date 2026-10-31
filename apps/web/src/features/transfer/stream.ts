import type { ImportProgressEvent } from "@dynamo-studio/shared";
import { takeProgressLines } from "./progress.js";

export async function readBlob(
  response: Response,
  onBytes: (bytes: number) => void,
): Promise<Blob> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    const blob = await response.blob();
    onBytes(blob.size);
    return blob;
  }
  const chunks: BlobPart[] = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    chunks.push(next.value);
    total += next.value.byteLength;
    onBytes(total);
  }
  return new Blob(chunks);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readProgress(
  response: Response,
  onEvent: (event: ImportProgressEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  if (reader === undefined) {
    buffer = await response.text();
  } else {
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      buffer += decoder.decode(next.value, { stream: true });
      const taken = takeProgressLines(buffer);
      buffer = taken.rest;
      for (const event of taken.events) {
        onEvent(event);
      }
    }
    buffer += decoder.decode();
  }
  const taken = takeProgressLines(`${buffer}\n`);
  for (const event of taken.events) {
    onEvent(event);
  }
}
