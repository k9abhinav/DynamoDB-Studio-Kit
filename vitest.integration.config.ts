import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@dynamo-studio/shared": fileURLToPath(
        new URL("./packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["apps/server/src/**/*.int.test.ts", "scripts/**/*.int.test.ts"],
    globalSetup: ["./scripts/global-setup.ts"],
    fileParallelism: false,
    execArgv: ["--expose-gc"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
  },
});
