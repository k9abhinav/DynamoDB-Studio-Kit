export const REQUIRED_NODE_MAJOR = 22;

export function nodeMajor(version: string): number {
  const major = Number(version.split(".")[0]);
  return Number.isInteger(major) ? major : Number.NaN;
}

export function nodeVersionMessage(version: string): string {
  return `DynamoDB Studio requires Node.js ${String(REQUIRED_NODE_MAJOR)} or newer. This process is ${version}.`;
}

export function nodeSupportWarning(version: string): string {
  return `Node.js ${String(REQUIRED_NODE_MAJOR)} is the supported major. This process is ${version}.`;
}

export function nodeStartupNotice(version: string): string | undefined {
  const major = nodeMajor(version);
  if (!Number.isInteger(major) || major < REQUIRED_NODE_MAJOR) {
    throw new Error(nodeVersionMessage(version));
  }
  if (major > REQUIRED_NODE_MAJOR) {
    return nodeSupportWarning(version);
  }
  return undefined;
}
