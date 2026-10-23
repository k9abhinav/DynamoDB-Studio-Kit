import { readFileSync } from "node:fs";
import { isConventionalCommit } from "./commit-message.js";

const file = process.argv[2];
if (file === undefined) {
  process.stderr.write("commit-msg hook expected a message file path\n");
  process.exit(1);
}

const message = readFileSync(file, "utf8");
if (!isConventionalCommit(message)) {
  process.stderr.write("Commit message must be a Conventional Commit, for example: chore: test\n");
  process.exit(1);
}
