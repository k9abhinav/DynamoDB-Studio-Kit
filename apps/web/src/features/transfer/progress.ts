import { ImportProgressEvent, type ImportProgressEvent as Progress } from "@dynamo-studio/shared";

export function takeProgressLines(buffer: string): { events: Progress[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: Progress[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    events.push(parseProgress(trimmed));
  }
  return { events, rest };
}

function parseProgress(line: string): Progress {
  let json: unknown;
  try {
    json = JSON.parse(line) as unknown;
  } catch {
    throw new Error("The progress stream was not valid JSON.");
  }
  const parsed = ImportProgressEvent.safeParse(json);
  if (!parsed.success) {
    throw new Error("The progress stream was not valid JSON.");
  }
  return parsed.data;
}
