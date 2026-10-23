import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5173",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "pnpm --filter @dynamo-studio/server dev",
      url: "http://127.0.0.1:8080/api/v1/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "pnpm --filter @dynamo-studio/web dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
