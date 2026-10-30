import { describe, expect, it, vi } from "vitest";
import type { Item } from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import type { ItemScope } from "./items.js";
import { writeImport, type ImportCounts } from "./import-write.js";

const keys = [{ name: "id", type: "S" as const }];

function item(id: string, note = "n"): Item {
  return { id: { S: id }, note: { S: note } };
}

function scope(client: DynamoCaller, signal?: AbortSignal): ItemScope {
  return { client, endpoint: "", table: "users", ...(signal === undefined ? {} : { signal }) };
}

function caller(send: DynamoCaller["send"]): DynamoCaller {
  return { destroy() {}, send };
}

async function collect(source: AsyncGenerator<ImportCounts>): Promise<ImportCounts> {
  let last: ImportCounts | undefined;
  for await (const counts of source) {
    last = counts;
  }
  if (last === undefined) {
    throw new Error("missing counts");
  }
  return last;
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function batchOf(command: { readonly input?: object }): unknown[] {
  const users = asRecord(asRecord(command.input)?.RequestItems)?.users;
  return Array.isArray(users) ? users : [];
}

describe("writeImport", () => {
  it("writes overwrite batches of 25, retries unprocessed items, and counts duplicates", async () => {
    const sizes: number[] = [];
    const client = caller((command) => {
      const batch = batchOf(command);
      sizes.push(batch.length);
      if (batch.length > 1) {
        return Promise.resolve({ UnprocessedItems: { users: batch.slice(0, 1) } });
      }
      return Promise.resolve({ UnprocessedItems: {} });
    });
    const rows = [
      ...Array.from({ length: 26 }, (_unused, index) => ({
        row: index + 1,
        item: item(String(index)),
      })),
      { row: 27, item: item("0", "later") },
    ];
    const result = await collect(
      writeImport({
        scope: scope(client),
        keys,
        mode: "put",
        dryRun: false,
        rows,
        sleep: () => Promise.resolve(),
      }),
    );
    expect(sizes.every((size) => size <= 25)).toBe(true);
    expect(sizes).toEqual([25, 1, 2, 1]);
    expect(result).toMatchObject({ processed: 27, written: 27, failed: 0, duplicates: 1 });
  });

  it("keeps the last duplicate in a batch", async () => {
    const notes: string[] = [];
    const client = caller((command) => {
      const batch = batchOf(command);
      const itemValue = asRecord(asRecord(asRecord(batch[0])?.PutRequest)?.Item);
      const note = asRecord(itemValue?.note)?.S;
      if (typeof note === "string") {
        notes.push(note);
      }
      return Promise.resolve({});
    });
    const result = await collect(
      writeImport({
        scope: scope(client),
        keys,
        mode: "put",
        dryRun: false,
        rows: [
          { row: 1, item: item("a", "first") },
          { row: 2, item: item("a", "second") },
        ],
      }),
    );
    expect(notes).toEqual(["second"]);
    expect(result.duplicates).toBe(1);
    expect(result.written).toBe(1);
  });

  it("skips existing keys with a condition and overwrites keys this import already wrote", async () => {
    const calls: { conditional: boolean; id: string }[] = [];
    let inflight = 0;
    let peak = 0;
    const client = caller(async (command) => {
      inflight += 1;
      peak = Math.max(peak, inflight);
      await Promise.resolve();
      inflight -= 1;
      const input = asRecord(command.input);
      const id = asRecord(asRecord(input?.Item)?.id)?.S;
      calls.push({
        conditional: typeof input?.ConditionExpression === "string",
        id: typeof id === "string" ? id : "",
      });
      if (id === "taken") {
        return Promise.reject(namedError("ConditionalCheckFailedException"));
      }
      return {};
    });
    const rows = [
      ...Array.from({ length: 8 }, (_unused, index) => ({
        row: index + 1,
        item: item(`new-${String(index)}`),
      })),
      { row: 9, item: item("new-0", "again") },
      { row: 10, item: item("taken") },
      { row: 11, item: item("taken", "later") },
    ];
    const result = await collect(
      writeImport({
        scope: scope(client),
        keys,
        mode: "skip-existing",
        dryRun: false,
        rows,
        sleep: () => Promise.resolve(),
      }),
    );
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
    const again = calls.find((call) => call.id === "new-0" && !call.conditional);
    expect(again).toBeDefined();
    expect(calls.filter((call) => call.id === "taken").every((call) => call.conditional)).toBe(
      true,
    );
    expect(result).toMatchObject({ written: 9, skipped: 2, duplicates: 2, failed: 0 });
  });

  it("retries a throttled batch and then writes it", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    let attempts = 0;
    const client = caller(() => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(namedError("ProvisionedThroughputExceededException"));
      }
      return Promise.resolve({});
    });
    const result = await collect(
      writeImport({
        scope: scope(client),
        keys,
        mode: "put",
        dryRun: false,
        rows: [{ row: 1, item: item("a") }],
        sleep,
      }),
    );
    expect(result.written).toBe(1);
    expect(sleep).toHaveBeenCalled();
  });

  it("does not write during a dry run and stops before the next batch when cancelled", async () => {
    let sends = 0;
    const client = caller(() => {
      sends += 1;
      return Promise.resolve({});
    });
    const dry = await collect(
      writeImport({
        scope: scope(client),
        keys,
        mode: "put",
        dryRun: true,
        rows: [
          { row: 1, item: item("a") },
          { row: 2, item: item("a", "dup") },
          { row: 3, error: "Missing key id." },
        ],
      }),
    );
    expect(sends).toBe(0);
    expect(dry).toMatchObject({ processed: 3, written: 0, failed: 1, duplicates: 1 });

    const controller = new AbortController();
    let sendsAfter = 0;
    const cancelling = caller(() => {
      sendsAfter += 1;
      controller.abort();
      return Promise.resolve({});
    });
    const cancelled = await collect(
      writeImport({
        scope: scope(cancelling, controller.signal),
        keys,
        mode: "put",
        dryRun: false,
        rows: Array.from({ length: 30 }, (_unused, index) => ({
          row: index + 1,
          item: item(String(index)),
        })),
      }),
    );
    expect(sendsAfter).toBe(1);
    expect(cancelled).toMatchObject({ written: 25, processed: 25 });
  });

  it("stops a 50,000 row stream after cancel and reports the rows already handled", async () => {
    let yielded = 0;
    const controller = new AbortController();
    function* rows() {
      for (let index = 0; index < 50_000; index += 1) {
        yielded += 1;
        if (index === 100) {
          controller.abort();
        }
        yield { row: index + 1, item: item(String(index)) };
      }
    }
    const result = await collect(
      writeImport({
        scope: scope(
          caller(() => Promise.resolve({})),
          controller.signal,
        ),
        keys,
        mode: "put",
        dryRun: false,
        rows: rows(),
      }),
    );
    expect(result).toMatchObject({ processed: 100, written: 100 });
    expect(yielded).toBeLessThan(200);
  });
});
