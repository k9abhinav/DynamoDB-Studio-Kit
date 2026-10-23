import { describe, expect, it } from "vitest";
import { nextThemeMode, readThemeMode, resolveColorScheme, writeThemeMode } from "./theme-mode.js";

describe("theme mode", () => {
  it("cycles light, dark, and system", () => {
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("system");
    expect(nextThemeMode("system")).toBe("light");
  });

  it("reads and writes the mui-mode key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    expect(readThemeMode(storage)).toBe("system");
    writeThemeMode(storage, "dark");
    expect(readThemeMode(storage)).toBe("dark");
    expect(values.get("mui-mode")).toBe("dark");
  });

  it("resolves system from the color scheme preference", () => {
    expect(resolveColorScheme("system", true)).toBe("dark");
    expect(resolveColorScheme("system", false)).toBe("light");
    expect(resolveColorScheme("dark", false)).toBe("dark");
  });
});
