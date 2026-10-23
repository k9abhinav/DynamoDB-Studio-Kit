import { buildApp } from "./app.js";
import { hostBindingWarning, loadConfig } from "./config.js";

const config = loadConfig(process.env);
const app = await buildApp({ logger: { level: config.logLevel } });
const warning = hostBindingWarning(config.host);
if (warning !== undefined) {
  app.log.warn(warning);
}

await app.listen({ host: config.host, port: config.port });
