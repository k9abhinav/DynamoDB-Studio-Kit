import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const monacoCss = realpathSync(
  path.join(webRoot, "node_modules/monaco-editor/min/vs/editor/editor.main.css"),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@dynamo-studio/shared",
        replacement: fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      },
      {
        find: "monaco-editor/min/vs/editor/editor.main.css",
        replacement: monacoCss,
      },
    ],
  },
  test: {
    name: "web",
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
