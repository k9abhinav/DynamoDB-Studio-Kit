import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Alias } from "vite";

const sharedSource = fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url));

const require = createRequire(import.meta.url);

/**
 * react-router@7.18.4's export map points `import`, `module`, and `default`
 * at `dist/development`. It has no `production` condition, so Vite's
 * production resolve conditions (and `NODE_ENV=production` from `vite build`)
 * still load the development build, where `ENABLE_DEV_WARNINGS` is true.
 * Alias the package root to `dist/production` only for production builds.
 */
function reactRouterProductionAliases(): Alias[] {
  const root = path.dirname(require.resolve("react-router/package.json"));
  return [
    {
      find: /^react-router\/dom$/,
      replacement: path.join(root, "dist/production/dom-export.mjs"),
    },
    {
      find: /^react-router$/,
      replacement: path.join(root, "dist/production/index.mjs"),
    },
  ];
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "assert-react-router-production",
      apply: "build",
      async buildStart() {
        if (mode !== "production") {
          return;
        }
        const resolved = await this.resolve("react-router");
        const id = resolved?.id ?? "";
        this.info(`react-router resolved to ${id}`);
        if (!id.includes("/dist/production/")) {
          this.error(
            `Production build resolved react-router to ${id || "nothing"}. Expected dist/production.`,
          );
        }
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@dynamo-studio/shared", replacement: sharedSource },
      ...(mode === "production" ? reactRouterProductionAliases() : []),
    ],
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:8080",
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    include: ["monaco-editor"],
  },
}));
