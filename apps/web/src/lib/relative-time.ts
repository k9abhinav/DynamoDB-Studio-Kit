export function relativeTime(iso: string, now = Date.now()): string {
  const delta = new Date(iso).getTime() - now;
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(delta);
  if (abs < 60_000) {
    return formatter.format(Math.round(delta / 1000), "second");
  }
  if (abs < 3_600_000) {
    return formatter.format(Math.round(delta / 60_000), "minute");
  }
  if (abs < 86_400_000) {
    return formatter.format(Math.round(delta / 3_600_000), "hour");
  }
  return formatter.format(Math.round(delta / 86_400_000), "day");
}
