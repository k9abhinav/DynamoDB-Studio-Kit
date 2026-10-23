export const MODE_STORAGE_KEY = "mui-mode";

export type ThemeMode = "light" | "dark" | "system";

const modes: readonly ThemeMode[] = ["light", "dark", "system"];

export function readThemeMode(storage: Pick<Storage, "getItem">): ThemeMode {
  const value = storage.getItem(MODE_STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function writeThemeMode(storage: Pick<Storage, "setItem">, mode: ThemeMode): void {
  storage.setItem(MODE_STORAGE_KEY, mode);
}

export function resolveColorScheme(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  const index = modes.indexOf(mode);
  const next = modes[(index + 1) % modes.length];
  return next ?? "system";
}
