import { createTheme } from "@mui/material/styles";
import type { SchemeColors } from "../styles/tokens.js";
import { darkColors, lightColors } from "../styles/tokens.js";

const menuShadow = "0 1px 2px rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)";
const layerShadow = "0 2px 6px 2px rgba(60, 64, 67, 0.15), 0 1px 2px rgba(60, 64, 67, 0.3)";

function palette(colors: SchemeColors) {
  return {
    primary: { main: colors.primary, contrastText: colors.onPrimary },
    background: { default: colors.bg, paper: colors.surface },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      disabled: colors.textDisabled,
    },
    error: { main: colors.error },
    success: { main: colors.success },
    warning: { main: colors.warning, contrastText: "#202124" },
    divider: colors.outline,
  };
}

export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: '[data-color-scheme="%s"]',
  },
  colorSchemes: {
    light: { palette: palette(lightColors) },
    dark: { palette: palette(darkColors) },
  },
  focusVisible: true,
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Roboto", system-ui, sans-serif',
    button: { textTransform: "none", fontWeight: 500 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: "1px solid var(--ds-outline)",
          boxShadow: "none",
          backgroundImage: "none",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, boxShadow: layerShadow },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { boxShadow: layerShadow, backgroundImage: "none" },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { boxShadow: menuShadow, border: "1px solid var(--ds-outline)" },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 12 },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: "var(--ds-text-primary)",
          color: "var(--ds-bg)",
        },
      },
    },
  },
});
