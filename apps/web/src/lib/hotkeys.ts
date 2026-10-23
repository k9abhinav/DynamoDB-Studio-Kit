export type HotkeyAction = "palette" | "shortcuts" | "toggle-sidebar" | "close";

export interface HotkeyInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  typing: boolean;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export function hotkeyAction(input: HotkeyInput): HotkeyAction | undefined {
  if (input.key === "Escape") {
    return "close";
  }
  if ((input.metaKey || input.ctrlKey) && !input.altKey && input.key.toLowerCase() === "k") {
    return "palette";
  }
  if (input.typing) {
    return undefined;
  }
  if (input.key === "?") {
    return "shortcuts";
  }
  if (input.key === "[") {
    return "toggle-sidebar";
  }
  return undefined;
}
