import MoreVertOutlined from "@mui/icons-material/MoreVertOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";
import { StatusChip } from "../../components/StatusChip.js";
import { ThemeToggle } from "../../components/ThemeToggle.js";
import { useOverlayStore } from "../../stores/overlay.js";
import { useUiStore } from "../../stores/ui.js";

export function StudioAppBar() {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const density = useUiStore((state) => state.density);
  const setDensity = useUiStore((state) => state.setDensity);
  const openOverlay = useOverlayStore((state) => state.openOverlay);

  return (
    <header className="flex h-14 items-center gap-2 border-b border-outline bg-surface px-3 xl:h-16">
      <span className="px-2 text-base font-medium">DynamoDB Studio</span>
      <Button
        variant="outlined"
        startIcon={<SearchOutlined />}
        className="mx-auto max-w-md min-w-0 flex-1 justify-start rounded-full"
        onClick={() => {
          openOverlay("palette");
        }}
      >
        <span className="truncate">Search tables, actions</span>
        <kbd className="ml-auto hidden font-mono text-xs text-text-secondary sm:inline">⌘K</kbd>
      </Button>
      <StatusChip />
      <ThemeToggle />
      <IconButton
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        onClick={(event) => {
          setMenu(event.currentTarget);
        }}
      >
        <MoreVertOutlined />
      </IconButton>
      <Menu
        anchorEl={menu}
        open={menu !== null}
        onClose={() => {
          setMenu(null);
        }}
      >
        <MenuItem
          selected={density === "comfortable"}
          onClick={() => {
            setDensity("comfortable");
            setMenu(null);
          }}
        >
          Comfortable
        </MenuItem>
        <MenuItem
          selected={density === "compact"}
          onClick={() => {
            setDensity("compact");
            setMenu(null);
          }}
        >
          Compact
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            openOverlay("about");
          }}
        >
          About
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenu(null);
            openOverlay("shortcuts");
          }}
        >
          Shortcuts
        </MenuItem>
      </Menu>
    </header>
  );
}
