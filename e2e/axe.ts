export function isSerious(impact: string | null | undefined): boolean {
  return impact === "serious" || impact === "critical";
}
