import { describe, expect, it } from "vitest";
import {
  BatchDeleteResponse,
  CSRF_HEADER,
  DeleteItemResponse,
  GetItemResponse,
  ItemWriteResponse,
  ScanResponse,
  formatPlain,
  fromPlainItem,
  itemHash,
  parsePlain,
  toPlainItem,
  type AttributeValue,
  type Item,
} from "@dynamo-studio/shared";
import { buildApp } from "../app.js";

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

async function connect(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string,
  csrf: string,
  readOnly: boolean,
) {
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/connections",
    headers: { cookie, [CSRF_HEADER]: csrf },
    payload: {
      endpoint: "http://127.0.0.1:8000",
      region: "us-east-1",
      auth: { type: "local" },
      env: "local",
      readOnly,
      remember: false,
    },
  });
  expect(created.statusCode).toBe(201);
  return created.json<{ connectionId: string }>().connectionId;
}

describe("item writes against DynamoDB Local", () => {
  it("creates, conflicts, rejects a changed key, and blocks an oversized item", async () => {
    const app = await buildApp();
    const open = await session(app);
    const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
    const writable = await connect(app, open.cookie, open.csrf, false);
    const readOnly = await connect(app, open.cookie, open.csrf, true);
    const id = `p5-${String(Date.now())}`;
    const item: Item = { id: { S: id }, email: { S: "a@b.c" }, n: { N: "1E+2" } };
    const url = (connectionId: string, action: string) =>
      `/api/v1/connections/${connectionId}/tables/users/items${action}`;

    const denied = await app.inject({
      method: "PUT",
      url: url(readOnly, ""),
      headers,
      payload: { item, ifNotExists: true },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json<{ error: { code: string } }>().error.code).toBe("READ_ONLY");

    const created = await app.inject({
      method: "PUT",
      url: url(writable, ""),
      headers,
      payload: { item, ifNotExists: true },
    });
    expect(created.statusCode).toBe(200);
    const saved = ItemWriteResponse.parse(created.json());
    expect(saved.item).toMatchObject({ id: { S: id }, email: { S: "a@b.c" }, n: { N: "100" } });
    expect(saved.hash).toBe(await itemHash(saved.item));
    expect(saved.weakConcurrency).toBeUndefined();

    const collision = await app.inject({
      method: "PUT",
      url: url(writable, ""),
      headers,
      payload: { item, ifNotExists: true },
    });
    expect(collision.statusCode).toBe(409);
    expect(collision.json<{ error: { message: string } }>().error.message).toBe(
      "An item with this key already exists.",
    );

    const loaded = await app.inject({
      method: "POST",
      url: url(writable, "/get"),
      headers,
      payload: { key: { id: { S: id } } },
    });
    expect(GetItemResponse.parse(loaded.json()).item).toEqual(saved.item);

    const changedKey = await app.inject({
      method: "POST",
      url: url(writable, "/update"),
      headers,
      payload: {
        key: { id: { S: id } },
        item: { id: { S: `${id}-other` }, email: { S: "b@b.c" } },
        expectedHash: saved.hash,
      },
    });
    expect(changedKey.statusCode).toBe(400);
    expect(changedKey.json<{ error: { code: string } }>().error.code).toBe("VALIDATION");

    const conflict = await app.inject({
      method: "POST",
      url: url(writable, "/update"),
      headers,
      payload: {
        key: { id: { S: id } },
        item: { ...saved.item, email: { S: "b@b.c" } },
        expectedHash: "not-the-hash",
      },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json<{ error: { code: string } }>().error.code).toBe("CONDITION_FAILED");

    const next: Item = { ...saved.item, email: { S: "b@b.c" } };
    const updated = await app.inject({
      method: "POST",
      url: url(writable, "/update"),
      headers,
      payload: { key: { id: { S: id } }, item: next, expectedHash: saved.hash },
    });
    expect(updated.statusCode).toBe(200);
    expect(ItemWriteResponse.parse(updated.json()).item).toEqual(next);

    const wide: Item = { id: { S: `${id}-wide` } };
    for (let index = 0; index < 151; index += 1) {
      wide[`a${String(index)}`] = { S: "x" };
    }
    const wideWrite = await app.inject({
      method: "PUT",
      url: url(writable, ""),
      headers,
      payload: { item: wide, ifNotExists: true },
    });
    const wideSaved = ItemWriteResponse.parse(wideWrite.json());
    const wideUpdate = await app.inject({
      method: "POST",
      url: url(writable, "/update"),
      headers,
      payload: {
        key: { id: { S: `${id}-wide` } },
        item: { ...wide, note: { S: "y" } },
        expectedHash: wideSaved.hash,
      },
    });
    expect(wideUpdate.statusCode).toBe(200);
    expect(ItemWriteResponse.parse(wideUpdate.json()).weakConcurrency).toBe(true);

    const oversized: Item = { id: { S: `${id}-big` }, blob: { S: "a".repeat(401 * 1024) } };
    const tooBig = await app.inject({
      method: "PUT",
      url: url(writable, ""),
      headers,
      payload: { item: oversized, ifNotExists: true },
    });
    expect(tooBig.statusCode).toBe(400);
    expect(tooBig.json<{ error: { code: string } }>().error.code).toBe("LIMIT_EXCEEDED");

    const removed = await app.inject({
      method: "POST",
      url: url(writable, "/delete"),
      headers,
      payload: { key: { id: { S: id } } },
    });
    expect(DeleteItemResponse.parse(removed.json())).toMatchObject({
      deleted: true,
      previousItem: next,
    });
    const again = await app.inject({
      method: "POST",
      url: url(writable, "/delete"),
      headers,
      payload: { key: { id: { S: id } } },
    });
    expect(DeleteItemResponse.parse(again.json())).toEqual({ deleted: false });
    await app.inject({
      method: "POST",
      url: url(writable, "/delete"),
      headers,
      payload: { key: { id: { S: `${id}-wide` } } },
    });

    const batchIds = [0, 1, 2].map((index) => `${id}-batch-${String(index)}`);
    for (const batchId of batchIds) {
      const put = await app.inject({
        method: "PUT",
        url: url(writable, ""),
        headers,
        payload: { item: { id: { S: batchId }, email: { S: "a@b.c" } }, ifNotExists: true },
      });
      expect(put.statusCode).toBe(200);
    }
    const batched = await app.inject({
      method: "POST",
      url: url(writable, "/batch-delete"),
      headers,
      payload: { keys: batchIds.map((batchId) => ({ id: { S: batchId } })) },
    });
    expect(batched.statusCode).toBe(200);
    expect(BatchDeleteResponse.parse(batched.json())).toEqual({ deleted: 3, failed: [] });
    const gone = await app.inject({
      method: "POST",
      url: url(writable, "/get"),
      headers,
      payload: { key: { id: { S: `${id}-batch-0` } } },
    });
    expect(GetItemResponse.parse(gone.json()).item).toBeNull();
  });

  it("round-trips every edge-cases item through plain JSON and the update route", async () => {
    const app = await buildApp();
    const open = await session(app);
    const headers = { cookie: open.cookie, [CSRF_HEADER]: open.csrf };
    const connectionId = await connect(app, open.cookie, open.csrf, false);
    const base = `/api/v1/connections/${connectionId}/tables/edge-cases`;
    const fixtureId = `p5-plain-${String(Date.now())}`;
    const digits = "12345678901234567890123456789012345678";
    const binary = Buffer.from("hi").toString("base64");
    const fixture: Item = {
      id: { S: fixtureId },
      $b: { S: "dollar-key" },
      exponent: { N: "1E+2" },
      digits: { N: digits },
      note: { S: "" },
      labels: { SS: ["alpha", "beta"] },
      scores: { NS: ["1", "1E+2", "2.5"] },
      payload: { B: binary },
      blobs: { BS: [binary] },
    };
    expect(plainRoundTrip(fixture)).toEqual(fixture);

    try {
      const put = await app.inject({
        method: "PUT",
        url: `${base}/items`,
        headers,
        payload: { item: fixture, ifNotExists: true },
      });
      expect(put.statusCode, put.body).toBe(200);
      const storedFixture = ItemWriteResponse.parse(put.json()).item;
      expect(storedFixture.$b).toEqual({ S: "dollar-key" });
      expect(storedFixture.exponent).toEqual({ N: "100" });
      expect(stableValue(storedFixture.scores ?? { NULL: true })).toEqual({
        NS: ["1", "100", "2.5"],
      });

      const items = await scanAll(app, headers, `${base}/scan`);
      const ids = items.map((item) => stringId(item));
      for (const name of ["number-38", "sets", "binary", "empty-string", "large", fixtureId]) {
        expect(ids).toContain(name);
      }

      for (const item of items) {
        const restored = plainRoundTrip(item);
        expect(stableItem(restored)).toEqual(stableItem(item));
        const key = { id: { S: stringId(item) } };
        const updated = await app.inject({
          method: "POST",
          url: `${base}/items/update`,
          headers,
          payload: { key, item: restored, expectedHash: await itemHash(item) },
        });
        expect(updated.statusCode, updated.body).toBe(200);
        const written = ItemWriteResponse.parse(updated.json()).item;
        expect(stableItem(written)).toEqual(stableItem(item));
        const again = await app.inject({
          method: "POST",
          url: `${base}/items/get`,
          headers,
          payload: { key },
        });
        const loaded = GetItemResponse.parse(again.json()).item;
        expect(loaded).not.toBeNull();
        if (loaded !== null) {
          expect(stableItem(loaded)).toEqual(stableItem(item));
        }
      }
    } finally {
      await app.inject({
        method: "POST",
        url: `${base}/items/delete`,
        headers,
        payload: { key: { id: { S: fixtureId } } },
      });
      await app.close();
    }
  });
});

function plainRoundTrip(item: Item): Item {
  return fromPlainItem(parsePlain(formatPlain(toPlainItem(item))));
}

async function scanAll(
  app: Awaited<ReturnType<typeof buildApp>>,
  headers: { cookie: string; [CSRF_HEADER]: string },
  url: string,
): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: string | undefined;
  do {
    const response = await app.inject({
      method: "POST",
      url,
      headers,
      payload: {
        limit: 100,
        fillPage: true,
        consistentRead: true,
        ...(cursor === undefined ? {} : { cursor }),
      },
    });
    expect(response.statusCode, response.body).toBe(200);
    const page = ScanResponse.parse(response.json());
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  return items;
}

function stringId(item: Item): string {
  const id = item.id;
  if (id === undefined || !("S" in id)) {
    throw new Error("edge-cases item is missing a string id");
  }
  return id.S;
}

function stableItem(item: Item): Item {
  const sorted: Item = {};
  for (const key of Object.keys(item).sort()) {
    const value = item[key];
    if (value !== undefined) {
      sorted[key] = stableValue(value);
    }
  }
  return sorted;
}

function stableValue(value: AttributeValue): AttributeValue {
  if ("SS" in value) {
    return { SS: [...value.SS].sort() };
  }
  if ("NS" in value) {
    return { NS: [...value.NS].sort() };
  }
  if ("BS" in value) {
    return { BS: [...value.BS].sort() };
  }
  if ("L" in value) {
    return { L: value.L.map((child) => stableValue(child)) };
  }
  if ("M" in value) {
    return { M: stableItem(value.M) };
  }
  return value;
}
