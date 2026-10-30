import { describe, expect, it } from "vitest";
import type { Item } from "@dynamo-studio/shared";
import type { DynamoCaller } from "../services/credentials.js";
import { clearPages } from "./clear-table.js";
import type { ItemScope } from "./items.js";

function key(id: string): Item {
  return { id: { S: id } };
}

function scope(signal?: AbortSignal): ItemScope {
  const client: DynamoCaller = {
    destroy() {},
    send(command) {
      const requestItems = asRecord(command.input)?.RequestItems;
      const users = asRecord(requestItems)?.users;
      const batch = Array.isArray(users) ? users : [];
      if (batch.length > 25) {
        return Promise.reject(new Error("chunk too big"));
      }
      return Promise.resolve({ UnprocessedItems: {} });
    },
  };
  return { client, endpoint: "", table: "users", ...(signal === undefined ? {} : { signal }) };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

describe("clearPages", () => {
  it("deletes every scanned key and stops before the next page when cancelled", async () => {
    const first = Array.from({ length: 30 }, (_unused, index) => key(String(index)));
    let calls = 0;
    const counts = [];
    for await (const page of clearPages({
      scope: scope(),
      load(cursor) {
        calls += 1;
        if (cursor === undefined) {
          return Promise.resolve({ items: first.slice(0, 25), nextCursor: "next" });
        }
        return Promise.resolve({ items: first.slice(25) });
      },
    })) {
      counts.push(page);
    }
    expect(calls).toBe(2);
    expect(counts.at(-1)).toMatchObject({ processed: 30, written: 30, failed: 0 });

    const controller = new AbortController();
    let loads = 0;
    const cancelled = [];
    const client: DynamoCaller = {
      destroy() {},
      send() {
        controller.abort();
        return Promise.resolve({ UnprocessedItems: {} });
      },
    };
    for await (const page of clearPages({
      scope: { client, endpoint: "", table: "users", signal: controller.signal },
      load() {
        loads += 1;
        return Promise.resolve({ items: [key("a")], nextCursor: "next" });
      },
    })) {
      cancelled.push(page);
    }
    expect(loads).toBe(1);
    expect(cancelled.at(-1)?.written).toBe(1);
  });
});
