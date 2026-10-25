import { describe, expect, it, vi } from "vitest";
import type { Item } from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import { batchDeleteItems } from "./batch-delete.js";
import type { ItemScope } from "./items.js";

function key(id: string): Item {
  return { id: { S: id } };
}

function batchOf(command: { readonly input?: object }): unknown[] {
  const requestItems = asRecord(command.input)?.RequestItems;
  const users = asRecord(requestItems)?.users;
  return Array.isArray(users) ? users : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

describe("batchDeleteItems", () => {
  it("retries one unprocessed key per chunk and never sends more than 25", async () => {
    const sent: number[] = [];
    const client: DynamoCaller = {
      destroy() {
        return undefined;
      },
      send(command) {
        const batch = batchOf(command);
        sent.push(batch.length);
        if (batch.length > 25) {
          return Promise.reject(new Error("chunk too big"));
        }
        if (batch.length > 1) {
          return Promise.resolve({ UnprocessedItems: { users: batch.slice(0, 1) } });
        }
        return Promise.resolve({ UnprocessedItems: {} });
      },
    };
    const keys = Array.from({ length: 30 }, (_unused, index) => key(String(index)));
    const result = await batchDeleteItems(scope(client), [...keys, key("0")], () =>
      Promise.resolve(),
    );
    expect(result).toEqual({ deleted: 30, failed: [] });
    expect(sent.every((count) => count <= 25)).toBe(true);
    expect(sent).toEqual([25, 1, 5, 1]);
  });

  it("returns keys that stay unprocessed after the retry budget", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const client: DynamoCaller = {
      destroy() {
        return undefined;
      },
      send(command) {
        return Promise.resolve({ UnprocessedItems: { users: batchOf(command) } });
      },
    };
    const result = await batchDeleteItems(scope(client), [key("a")], sleep);
    expect(result.deleted).toBe(0);
    expect(result.failed).toEqual([key("a")]);
    expect(sleep).toHaveBeenCalledTimes(7);
  });

  it("does not start the next chunk after the request is aborted", async () => {
    const controller = new AbortController();
    let sends = 0;
    const client: DynamoCaller = {
      destroy() {
        return undefined;
      },
      send() {
        sends += 1;
        controller.abort();
        return Promise.resolve({ UnprocessedItems: {} });
      },
    };
    const keys = Array.from({ length: 26 }, (_unused, index) => key(String(index)));
    await expect(
      batchDeleteItems(scope(client, controller.signal), keys, () => Promise.resolve()),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(sends).toBe(1);
  });
});

function scope(client: DynamoCaller, signal?: AbortSignal): ItemScope {
  return {
    client,
    endpoint: "http://127.0.0.1:8000",
    table: "users",
    ...(signal === undefined ? {} : { signal }),
  };
}
