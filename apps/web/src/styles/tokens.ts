export interface SchemeColors {
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  bg: string;
  surface: string;
  surfaceVariant: string;
  outline: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  error: string;
  errorContainer: string;
  success: string;
  successContainer: string;
  warning: string;
  warningContainer: string;
  warningText: string;
}

export const lightColors: SchemeColors = {
  primary: "#1967D2",
  primaryContainer: "#E8F0FE",
  onPrimary: "#FFFFFF",
  bg: "#F8F9FA",
  surface: "#FFFFFF",
  surfaceVariant: "#F1F3F4",
  outline: "#DADCE0",
  textPrimary: "#202124",
  textSecondary: "#5F6368",
  textDisabled: "#727272",
  error: "#D93025",
  errorContainer: "#FCE8E6",
  success: "#1E8E3E",
  successContainer: "#E6F4EA",
  warning: "#F9AB00",
  warningContainer: "#FEF7E0",
  warningText: "#8A5A00",
};

export const darkColors: SchemeColors = {
  primary: "#8AB4F8",
  primaryContainer: "#1F3A5F",
  onPrimary: "#062E6F",
  bg: "#202124",
  surface: "#292A2D",
  surfaceVariant: "#35363A",
  outline: "#3C4043",
  textPrimary: "#E8EAED",
  textSecondary: "#9AA0A6",
  textDisabled: "#9AA0A6",
  error: "#F28B82",
  errorContainer: "#5C2B29",
  success: "#81C995",
  successContainer: "#16352A",
  warning: "#FDD663",
  warningContainer: "#3E2E00",
  warningText: "#F6C343",
};

export const envColors = {
  local: "#5F6368",
  dev: "#1A73E8",
  staging: "#F9AB00",
  production: "#D93025",
} as const;

export const cssVariableNames: Record<keyof SchemeColors, string> = {
  primary: "--ds-primary",
  primaryContainer: "--ds-primary-container",
  onPrimary: "--ds-on-primary",
  bg: "--ds-bg",
  surface: "--ds-surface",
  surfaceVariant: "--ds-surface-variant",
  outline: "--ds-outline",
  textPrimary: "--ds-text-primary",
  textSecondary: "--ds-text-secondary",
  textDisabled: "--ds-text-disabled",
  error: "--ds-error",
  errorContainer: "--ds-error-container",
  success: "--ds-success",
  successContainer: "--ds-success-container",
  warning: "--ds-warning",
  warningContainer: "--ds-warning-container",
  warningText: "--ds-warning-text",
};

export interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
}

export function contrastPairs(colors: SchemeColors): ContrastPair[] {
  const surfaces = [
    ["bg", colors.bg],
    ["surface", colors.surface],
    ["surface-variant", colors.surfaceVariant],
  ] as const;
  const pairs: ContrastPair[] = [];
  for (const [surfaceName, background] of surfaces) {
    pairs.push({
      name: `text-primary on ${surfaceName}`,
      foreground: colors.textPrimary,
      background,
    });
    pairs.push({
      name: `text-secondary on ${surfaceName}`,
      foreground: colors.textSecondary,
      background,
    });
  }
  for (const [surfaceName, background] of surfaces) {
    pairs.push({
      name: `primary on ${surfaceName}`,
      foreground: colors.primary,
      background,
    });
  }
  pairs.push(
    {
      name: "primary on primary-container",
      foreground: colors.primary,
      background: colors.primaryContainer,
    },
    { name: "on-primary on primary", foreground: colors.onPrimary, background: colors.primary },
    { name: "warning-text on bg", foreground: colors.warningText, background: colors.bg },
    {
      name: "warning-text on surface",
      foreground: colors.warningText,
      background: colors.surface,
    },
    { name: "text-disabled on bg", foreground: colors.textDisabled, background: colors.bg },
    {
      name: "text-disabled on surface",
      foreground: colors.textDisabled,
      background: colors.surface,
    },
    {
      name: "text-primary on error-container",
      foreground: colors.textPrimary,
      background: colors.errorContainer,
    },
    {
      name: "text-primary on success-container",
      foreground: colors.textPrimary,
      background: colors.successContainer,
    },
    {
      name: "text-primary on warning-container",
      foreground: colors.textPrimary,
      background: colors.warningContainer,
    },
  );
  return pairs;
}
