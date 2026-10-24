import CloseOutlined from "@mui/icons-material/CloseOutlined";
import IconButton from "@mui/material/IconButton";
import useMediaQuery from "@mui/material/useMediaQuery";
import Unstable_TrapFocus from "@mui/material/Unstable_TrapFocus";
import { DRAWER_BREAKPOINT, DRAWER_MAX, DRAWER_MIN } from "../../lib/layout.js";
import { useUiStore } from "../../stores/ui.js";

export function ItemDrawer() {
  const open = useUiStore((state) => state.drawerOpen);
  const width = useUiStore((state) => state.drawerWidth);
  const setWidth = useUiStore((state) => state.setDrawerWidth);
  const setOpen = useUiStore((state) => state.setDrawerOpen);
  const preview = useUiStore((state) => state.itemPreview);
  const overlay = useMediaQuery(`(max-width: ${String(DRAWER_BREAKPOINT - 1)}px)`);
  if (!open) {
    return null;
  }

  const panel = (
    <Unstable_TrapFocus open>
      <div
        role="dialog"
        aria-labelledby="item-drawer-title"
        className={`flex h-full flex-col border-l border-outline bg-surface ${
          overlay ? "fixed top-14 right-0 bottom-0 z-20 xl:top-16" : "relative"
        }`}
        style={{ width }}
      >
        <header className="flex items-center justify-between border-b border-outline px-4 py-3">
          <h2 id="item-drawer-title" className="text-base font-medium">
            Item details
          </h2>
          <IconButton
            aria-label="Close item details"
            onClick={() => {
              setOpen(false);
            }}
          >
            <CloseOutlined />
          </IconButton>
        </header>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- ARIA widget separator resizes the drawer */}
        <div
          role="separator"
          // ARIA widget separators expose a value and stay focusable so arrow keys can resize.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- widget separator
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuemin={DRAWER_MIN}
          aria-valuemax={DRAWER_MAX}
          aria-valuenow={width}
          aria-label="Resize item details"
          className="absolute top-0 left-0 h-full w-2 cursor-col-resize"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setWidth(width - 16);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setWidth(width + 16);
            }
          }}
          onPointerDown={(event) => {
            const startX = event.clientX;
            const startWidth = width;
            const target = event.currentTarget;
            target.setPointerCapture(event.pointerId);
            const move = (pointer: PointerEvent) => {
              setWidth(startWidth - (pointer.clientX - startX));
            };
            const stop = () => {
              target.removeEventListener("pointermove", move);
              target.removeEventListener("pointerup", stop);
            };
            target.addEventListener("pointermove", move);
            target.addEventListener("pointerup", stop);
          }}
        />
        {preview === null ? (
          <p className="px-4 py-6 text-sm text-text-secondary">
            Select an item to see its details.
          </p>
        ) : (
          <pre className="min-h-0 flex-1 overflow-auto px-4 py-4 font-mono text-[13px] leading-5">
            {preview}
          </pre>
        )}
      </div>
    </Unstable_TrapFocus>
  );

  if (!overlay) {
    return panel;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close item details"
        className="fixed inset-0 z-10 bg-text/30"
        onClick={() => {
          setOpen(false);
        }}
      />
      {panel}
    </>
  );
}
