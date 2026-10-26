import { describe, expect, it } from "vitest";
import type { DynamoCaller } from "../services/credentials.js";
import { encodePartiqlCursor } from "./partiql-cursor.js";
import { partiqlPosition } from "./partiql-position.js";
import { executePartiql } from "./partiql.js";

function caller(
  send: (
    command: { readonly input?: { Statement?: string; NextToken?: string } },
    options?: { abortSignal?: AbortSignal },
  ) => unknown,
): DynamoCaller {
  return {
    destroy() {
      return undefined;
    },
    send(command, options) {
      return Promise.resolve(send(command, options));
    },
  };
}

describe("executePartiql", () => {
  it("rejects a cursor that belongs to a different statement", async () => {
    const cursor = encodePartiqlCursor("token", {
      statement: 'SELECT * FROM "users"',
      parameters: [],
      consistentRead: false,
    });
    const client = caller(() => {
      throw new Error("should not execute");
    });
    await expect(
      executePartiql(client, "", {
        statement: 'SELECT * FROM "orders"',
        limit: 10,
        cursor,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("stops the page loop when the request is aborted", async () => {
    let calls = 0;
    const client = caller((_command, options) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        const abort = () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        };
        if (options?.abortSignal?.aborted === true) {
          abort();
          return;
        }
        options?.abortSignal?.addEventListener("abort", abort, { once: true });
      });
    });
    const controller = new AbortController();
    const pending = executePartiql(client, "", {
      statement: 'SELECT * FROM "users"',
      limit: 50,
      signal: controller.signal,
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(1);
  });

  it("rejects a statement over 8192 bytes before calling DynamoDB", async () => {
    const client = caller(() => {
      throw new Error("should not execute");
    });
    await expect(
      executePartiql(client, "", {
        statement: `SELECT ${"a".repeat(8200)}`,
        limit: 1,
      }),
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });
});

describe("partiqlPosition", () => {
  it("reads a line and column, or a single position, and ignores a message without one", () => {
    expect(partiqlPosition("Unexpected token at line 2, column 4")).toEqual({ line: 2, column: 4 });
    expect(partiqlPosition("error at position 12")).toEqual({ line: 1, column: 12 });
    expect(partiqlPosition("ValidationException")).toBeUndefined();
  });
});
