export type HotkeyAction = "palette" | "shortcuts" | "toggle-sidebar" | "close";
export type EditorAction = "save" | "format" | "toggle-json-mode";
export type QueryAction = "run";
export type GridMotion =
  | "down"
  | "up"
  | "right"
  | "left"
  | "home"
  | "end"
  | "page-down"
  | "page-up"
  | "select"
  | "open"
  | "clear";

export interface HotkeyInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  typing: boolean;
}

export interface Shortcut {
  id: string;
  label: string;
  keys: string;
  group: "Anywhere" | "Item editor" | "Query" | "Items grid";
  scope: "global" | "editor" | "query" | "grid" | "separator";
  whileTyping: boolean;
  match: (input: HotkeyInput) => boolean;
}

const gridKeys: Record<GridMotion, string> = {
  down: "ArrowDown",
  up: "ArrowUp",
  right: "ArrowRight",
  left: "ArrowLeft",
  home: "Home",
  end: "End",
  "page-down": "PageDown",
  "page-up": "PageUp",
  select: " ",
  open: "Enter",
  clear: "Escape",
};

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

export function gridMotion(key: string): GridMotion | undefined {
  for (const motion of Object.keys(gridKeys) as GridMotion[]) {
    if (gridKeys[motion] === key) {
      return motion;
    }
  }
  return undefined;
}

export function resizeStep(key: string): number | undefined {
  if (key === "ArrowLeft") {
    return -16;
  }
  if (key === "ArrowRight") {
    return 16;
  }
  return undefined;
}

function command(input: HotkeyInput): boolean {
  return input.metaKey || input.ctrlKey;
}

function keyIs(input: HotkeyInput, key: string): boolean {
  return input.key.toLowerCase() === key;
}

function gridMatch(motions: readonly GridMotion[]): (input: HotkeyInput) => boolean {
  return (input) => {
    const motion = gridMotion(input.key);
    return motion !== undefined && motions.includes(motion);
  };
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: "palette",
    label: "Search",
    keys: "Ctrl K or ⌘K",
    group: "Anywhere",
    scope: "global",
    whileTyping: true,
    match: (input) => command(input) && !input.altKey && keyIs(input, "k"),
  },
  {
    id: "shortcuts",
    label: "Keyboard shortcuts",
    keys: "?",
    group: "Anywhere",
    scope: "global",
    whileTyping: false,
    match: (input) => input.key === "?",
  },
  {
    id: "toggle-sidebar",
    label: "Toggle sidebar",
    keys: "[",
    group: "Anywhere",
    scope: "global",
    whileTyping: false,
    match: (input) => input.key === "[",
  },
  {
    id: "close",
    label: "Close",
    keys: "Esc",
    group: "Anywhere",
    scope: "global",
    whileTyping: true,
    match: (input) => input.key === "Escape",
  },
  {
    id: "save",
    label: "Save item",
    keys: "Ctrl S or ⌘S",
    group: "Item editor",
    scope: "editor",
    whileTyping: true,
    match: (input) => command(input) && keyIs(input, "s"),
  },
  {
    id: "format",
    label: "Format JSON",
    keys: "Ctrl Shift F or ⌘⇧F",
    group: "Item editor",
    scope: "editor",
    whileTyping: true,
    match: (input) => command(input) && input.shiftKey && keyIs(input, "f"),
  },
  {
    id: "toggle-json-mode",
    label: "Toggle JSON mode",
    keys: "Alt M",
    group: "Item editor",
    scope: "editor",
    whileTyping: true,
    match: (input) => input.altKey && keyIs(input, "m"),
  },
  {
    id: "resize-drawer",
    label: "Resize the drawer or a column",
    keys: "Arrow left or Arrow right",
    group: "Item editor",
    scope: "separator",
    whileTyping: false,
    match: (input) => resizeStep(input.key) !== undefined,
  },
  {
    id: "run",
    label: "Run query",
    keys: "Ctrl Enter or ⌘Enter",
    group: "Query",
    scope: "query",
    whileTyping: true,
    match: (input) => command(input) && input.key === "Enter",
  },
  {
    id: "grid-move",
    label: "Move between cells",
    keys: "Arrow keys",
    group: "Items grid",
    scope: "grid",
    whileTyping: false,
    match: gridMatch(["down", "up", "left", "right"]),
  },
  {
    id: "grid-edge",
    label: "First or last cell",
    keys: "Home or End",
    group: "Items grid",
    scope: "grid",
    whileTyping: false,
    match: gridMatch(["home", "end"]),
  },
  {
    id: "grid-page",
    label: "Page through rows",
    keys: "Page up or Page down",
    group: "Items grid",
    scope: "grid",
    whileTyping: false,
    match: gridMatch(["page-up", "page-down"]),
  },
  {
    id: "grid-select",
    label: "Select the row",
    keys: "Space",
    group: "Items grid",
    scope: "grid",
    whileTyping: false,
    match: gridMatch(["select"]),
  },
  {
    id: "grid-open",
    label: "Open the item",
    keys: "Enter",
    group: "Items grid",
    scope: "grid",
    whileTyping: false,
    match: gridMatch(["open"]),
  },
  {
    id: "grid-clear",
    label: "Clear the selection",
    keys: "Esc",
    group: "Items grid",
    scope: "grid",
    whileTyping: false,
    match: gridMatch(["clear"]),
  },
];

export function shortcutGroups(): { group: Shortcut["group"]; items: Shortcut[] }[] {
  const groups: { group: Shortcut["group"]; items: Shortcut[] }[] = [];
  for (const shortcut of SHORTCUTS) {
    const last = groups.at(-1);
    if (last?.group === shortcut.group) {
      last.items.push(shortcut);
    } else {
      groups.push({ group: shortcut.group, items: [shortcut] });
    }
  }
  return groups;
}

function matchScope(scope: Shortcut["scope"], input: HotkeyInput): string | undefined {
  for (const shortcut of SHORTCUTS) {
    if (shortcut.scope !== scope) {
      continue;
    }
    if (input.typing && !shortcut.whileTyping) {
      continue;
    }
    if (shortcut.match(input)) {
      return shortcut.id;
    }
  }
  return undefined;
}

export function hotkeyAction(input: HotkeyInput): HotkeyAction | undefined {
  const id = matchScope("global", input);
  if (id === "palette" || id === "shortcuts" || id === "toggle-sidebar" || id === "close") {
    return id;
  }
  return undefined;
}

export function editorAction(input: HotkeyInput): EditorAction | undefined {
  const id = matchScope("editor", input);
  if (id === "save" || id === "format" || id === "toggle-json-mode") {
    return id;
  }
  return undefined;
}

export function queryAction(input: HotkeyInput): QueryAction | undefined {
  return matchScope("query", input) === "run" ? "run" : undefined;
}

export function readHotkey(event: KeyboardEvent, typing: boolean): HotkeyInput {
  return {
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    typing,
  };
}
