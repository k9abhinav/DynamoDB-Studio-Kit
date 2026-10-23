import { initialBudgetMessage, initialJavaScriptGzip } from "./check-bundle.js";

const budget = 250 * 1024;
const bytes = await initialJavaScriptGzip("apps/web/dist");

process.stdout.write(`${initialBudgetMessage(bytes, budget)}\n`);
if (bytes > budget) {
  process.stderr.write("Initial JavaScript exceeds the 250 KB gzip budget\n");
  process.exit(1);
}
