import { describe, expect, it } from "vitest";
import { hotkeyAction } from "./hotkeys.js";

const idle = { metaKey: false, ctrlKey: false, altKey: false, typing: false };

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
});
