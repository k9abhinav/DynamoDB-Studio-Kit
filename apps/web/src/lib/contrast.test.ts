import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast.js";
import {
  contrastPairs,
  cssVariableNames,
  darkColors,
  lightColors,
  type SchemeColors,
} from "../styles/tokens.js";

const minimum = 4.5;

describe("token contrast", () => {
  it.each([
    ["light", lightColors],
    ["dark", darkColors],
  ] as const)("meets AA for %s text and container pairs", (_scheme, colors) => {
    for (const pair of contrastPairs(colors)) {
      expect(contrastRatio(pair.foreground, pair.background), pair.name).toBeGreaterThanOrEqual(
        minimum,
      );
    }
  });

  it("mirrors the token hex values in tokens.css", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../styles/tokens.css"),
      "utf8",
    );
    expect(css).toContain('[data-color-scheme="dark"]');
    assertScheme(css, lightColors, css.indexOf("[data-color-scheme"));
    const darkStart = css.indexOf('[data-color-scheme="dark"]');
    assertScheme(css.slice(darkStart), darkColors, css.length);
  });
});

function assertScheme(css: string, colors: SchemeColors, end: number): void {
  const slice = css.slice(0, end);
  for (const key of Object.keys(cssVariableNames) as (keyof SchemeColors)[]) {
    expect(slice.toLowerCase()).toContain(`${cssVariableNames[key]}: ${colors[key]}`.toLowerCase());
  }
}
