import { createLocalClient, assertLocalReachable } from "./seed-data.js";

export async function setup(): Promise<void> {
  const client = createLocalClient();
  try {
    await assertLocalReachable(client);
  } finally {
    client.destroy();
  }
}
