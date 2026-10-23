import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { rowHeight } from "../lib/layout.js";
import { theme } from "./theme.js";
import { useUiStore } from "../stores/ui.js";
import { Hotkeys } from "./Hotkeys.js";
import { SnackbarHost } from "../components/SnackbarHost.js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export function AppProviders({ children }: { children: ReactNode }) {
  const density = useUiStore((state) => state.density);
  useEffect(() => {
    document.documentElement.style.setProperty("--row-height", rowHeight(density));
  }, [density]);

  return (
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeProvider
        theme={theme}
        defaultMode="system"
        modeStorageKey="mui-mode"
        disableTransitionOnChange
      >
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <Hotkeys />
          {children}
          <SnackbarHost />
        </QueryClientProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
