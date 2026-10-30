import { describe, expect, it } from "vitest";
import type { Item } from "@dynamo-studio/shared";
import { exportChunks } from "./export-stream.js";

function item(id: string): Item {
  return { id: { S: id } };
}

describe("exportChunks", () => {
  it("stops at maxItems and writes the NDJSON summary", async () => {
    const pages = [
      [item("a"), item("b")],
      [item("c"), item("d")],
    ];
    const text = await textOf(pages, 3);
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(4);
    const summary = JSON.parse(lines[3] ?? "{}") as {
      __summary?: { items?: number; bytes?: number };
    };
    expect(summary.__summary?.items).toBe(3);
    expect(typeof summary.__summary?.bytes).toBe("number");
    expect(text).not.toContain('"d"');
  });

  it("stops when the request is aborted before the next page", async () => {
    const controller = new AbortController();
    let calls = 0;
    const chunks: string[] = [];
    for await (const chunk of exportChunks({
      request: { format: "ndjson", typed: true, scope: "all" },
      signal: controller.signal,
      page: () => {
        calls += 1;
        if (calls === 1) {
          controller.abort();
        }
        return Promise.resolve({
          items: [item(String(calls))],
          nextCursor: "more",
        });
      },
    })) {
      chunks.push(chunk);
    }
    expect(calls).toBe(1);
    expect(chunks.join("")).toContain('{"S":"1"}');
    expect(chunks.join("")).not.toContain('{"S":"2"}');
  });
});

async function textOf(pages: Item[][], maxItems: number): Promise<string> {
  let index = 0;
  let text = "";
  for await (const chunk of exportChunks({
    request: { format: "ndjson", typed: true, scope: "all", maxItems },
    page: () => {
      const items = pages[index] ?? [];
      index += 1;
      const next = pages[index];
      return Promise.resolve({
        items,
        ...(next === undefined ? {} : { nextCursor: String(index) }),
      });
    },
  })) {
    text += chunk;
  }
  return text;
}
