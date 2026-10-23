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
    expect(edge).toBe(7);
  });
});
