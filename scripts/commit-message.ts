const CONVENTIONAL = /^(feat|fix|test|refactor|chore|docs|perf)(\([a-z0-9-]+\))?: \S.+/;

export function isConventionalCommit(message: string): boolean {
  const subject = message
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));
  if (subject === undefined) {
    return false;
  }
  return CONVENTIONAL.test(subject);
}
