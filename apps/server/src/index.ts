import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { hostBindingWarning, loadConfig } from "./config.js";

const config = loadConfig(process.env);
const allowedOrigins = config.allowedOrigins
  ?.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const app = await buildApp({
  logger: { level: config.logLevel },
  allowedHosts: [config.host],
  ...(allowedOrigins === undefined ? {} : { allowedOrigins }),
  ...(process.env.NODE_ENV === "production"
    ? { staticRoot: fileURLToPath(new URL("../../web/dist", import.meta.url)) }
    : {}),
});
const warning = hostBindingWarning(config.host);
if (warning !== undefined) {
  app.log.warn(warning);
}

await app.listen({ host: config.host, port: config.port });
