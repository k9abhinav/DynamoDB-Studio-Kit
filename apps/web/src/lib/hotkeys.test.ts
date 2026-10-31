import { describe, expect, it } from "vitest";
import {
  SHORTCUTS,
  editorAction,
  gridMotion,
  hotkeyAction,
  queryAction,
  readHotkey,
  resizeStep,
} from "./hotkeys.js";

const idle = {
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  typing: false,
};

const gridKeys = [
  "ArrowDown",
  "ArrowUp",
  "ArrowRight",
  "ArrowLeft",
  "Home",
  "End",
  "PageDown",
  "PageUp",
  " ",
  "Enter",
  "Escape",
];

describe("hotkeyAction", () => {
  it("opens the palette from command or control K even while typing", () => {
    expect(hotkeyAction({ ...idle, key: "k", metaKey: true, typing: true })).toBe("palette");
    expect(hotkeyAction({ ...idle, key: "k", ctrlKey: true })).toBe("palette");
  });

  it("ignores shortcut and sidebar keys while typing", () => {
    expect(hotkeyAction({ ...idle, key: "?", typing: true })).toBeUndefined();
    expect(hotkeyAction({ ...idle, key: "[", typing: true })).toBeUndefined();
  });

  it("maps the shell shortcuts", () => {
    expect(hotkeyAction({ ...idle, key: "?" })).toBe("shortcuts");
    expect(hotkeyAction({ ...idle, key: "[" })).toBe("toggle-sidebar");
    expect(hotkeyAction({ ...idle, key: "Escape" })).toBe("close");
  });

  it("keeps editor and query chords on the same list as the help dialog", () => {
    expect(editorAction({ ...idle, key: "s", ctrlKey: true, typing: true })).toBe("save");
    expect(editorAction({ ...idle, key: "f", metaKey: true, shiftKey: true })).toBe("format");
    expect(editorAction({ ...idle, key: "m", altKey: true })).toBe("toggle-json-mode");
    expect(editorAction({ ...idle, key: "f", ctrlKey: true })).toBeUndefined();
    expect(queryAction({ ...idle, key: "Enter", metaKey: true, typing: true })).toBe("run");
    const saved = new KeyboardEvent("keydown", { key: "s", ctrlKey: true });
    expect(editorAction(readHotkey(saved, true))).toBe("save");
    expect(hotkeyAction({ ...idle, key: "Enter", ctrlKey: true })).toBeUndefined();
    for (const id of ["save", "format", "toggle-json-mode", "run", "resize-drawer"]) {
      expect(SHORTCUTS.some((shortcut) => shortcut.id === id)).toBe(true);
    }
  });

  it("documents every grid key once", () => {
    for (const key of gridKeys) {
      const hits = SHORTCUTS.filter(
        (shortcut) => shortcut.scope === "grid" && shortcut.match({ ...idle, key }),
      );
      expect(hits).toHaveLength(1);
      expect(gridMotion(key)).toBeDefined();
    }
    expect(resizeStep("ArrowLeft")).toBe(-16);
    expect(resizeStep("ArrowRight")).toBe(16);
    expect(
      SHORTCUTS.find((shortcut) => shortcut.id === "resize-drawer")?.match({
        ...idle,
        key: "ArrowLeft",
      }),
    ).toBe(true);
  });
});
