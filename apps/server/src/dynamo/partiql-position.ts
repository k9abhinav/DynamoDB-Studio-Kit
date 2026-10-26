const lineAndColumn = /line\s+(\d+)\D+column\s+(\d+)/iu;
const positionOnly = /position\s+(\d+)/iu;

/** A 1-based line and column copied from a DynamoDB message, when the message includes one. */
export function partiqlPosition(message: string): { line: number; column: number } | undefined {
  const lined = lineAndColumn.exec(message);
  if (lined?.[1] !== undefined && lined[2] !== undefined) {
    return { line: Number(lined[1]), column: Number(lined[2]) };
  }
  const only = positionOnly.exec(message);
  if (only?.[1] !== undefined) {
    return { line: 1, column: Number(only[1]) };
  }
  return undefined;
}
