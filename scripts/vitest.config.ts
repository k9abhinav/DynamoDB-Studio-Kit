import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "scripts",
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/*.int.test.ts"],
  },
});
