import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { afterAll, describe, expect, it } from "vitest";
import { countItems, createLocalClient, seed } from "./seed-data.js";

describe("seed data", () => {
  const client = createLocalClient();

  afterAll(() => {
    client.destroy();
  });

  it("creates users(1000), orders(10000), sessions, and edge-cases", async () => {
    const started = Date.now();
    await seed(client);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(15_000);
    expect(await countItems(client, "users")).toBe(1000);
    expect(await countItems(client, "orders")).toBe(10_000);
    expect(await countItems(client, "sessions")).toBeGreaterThan(0);
    const edge = await countItems(client, "edge-cases");
    expect(edge).toBe(10);
    const digits = "12345678901234567890123456789012345678";
    const number = await client.send(
      new GetItemCommand({ TableName: "edge-cases", Key: { id: { S: "number-38" } } }),
    );
    expect(number.Item?.digits).toEqual({ N: digits });
    const address = await client.send(
      new GetItemCommand({ TableName: "edge-cases", Key: { id: { S: "address-pune" } } }),
    );
    expect(address.Item?.address).toEqual({ M: { city: { S: "Pune" } } });
  });
});
