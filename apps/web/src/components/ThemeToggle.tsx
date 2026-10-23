import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import SettingsBrightnessOutlined from "@mui/icons-material/SettingsBrightnessOutlined";
import IconButton from "@mui/material/IconButton";
import { useColorScheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import { nextThemeMode, type ThemeMode } from "../lib/theme-mode.js";

const labels: Record<ThemeMode, string> = {
  light: "Theme mode: Light",
  dark: "Theme mode: Dark",
  system: "Theme mode: System",
};

export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();
  const current: ThemeMode =
    mode === "light" || mode === "dark" || mode === "system" ? mode : "system";
  const Icon =
    current === "dark"
      ? DarkModeOutlined
      : current === "light"
        ? LightModeOutlined
        : SettingsBrightnessOutlined;

  return (
    <Tooltip title={labels[current]}>
      <IconButton
        aria-label={labels[current]}
        onClick={() => {
          setMode(nextThemeMode(current));
        }}
      >
        <Icon />
      </IconButton>
    </Tooltip>
  );
}
