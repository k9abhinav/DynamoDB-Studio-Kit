import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { hostBindingWarning, loadConfig } from "./config.js";
import { nodeStartupNotice } from "./node-version.js";

function productionStaticRoot(): string | undefined {
  if (process.env.NODE_ENV !== "production") {
    return undefined;
  }
  const root = fileURLToPath(new URL("../../web/dist", import.meta.url));
  return existsSync(root) ? root : undefined;
}

const nodeNotice = nodeStartupNotice(process.versions.node);

const config = loadConfig(process.env);
const allowedOrigins = config.allowedOrigins
  ?.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const staticRoot = productionStaticRoot();
const app = await buildApp({
  logger: { level: config.logLevel },
  allowedHosts: [config.host],
  studioHome: config.dynamoStudioHome ?? join(homedir(), ".dynamo-studio"),
  ...(allowedOrigins === undefined ? {} : { allowedOrigins }),
  ...(staticRoot === undefined ? {} : { staticRoot }),
});
if (nodeNotice !== undefined) {
  app.log.warn(nodeNotice);
}
const warning = hostBindingWarning(config.host);
if (warning !== undefined) {
  app.log.warn(warning);
}

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) {
    return;
  }
  stopping = true;
  const force = setTimeout(() => {
    process.exit(0);
  }, 4_000);
  force.unref();
  try {
    if (typeof app.server.closeAllConnections === "function") {
      app.server.closeAllConnections();
    }
    await app.close();
  } finally {
    clearTimeout(force);
    process.exit(0);
  }
}

process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});

await app.listen({ host: config.host, port: config.port });
