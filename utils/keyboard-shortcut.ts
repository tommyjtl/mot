export type KeyboardShortcut = {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export const DEFAULT_SPEAK_SHORTCUT: KeyboardShortcut = {
  code: "KeyS",
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

export const DEFAULT_TRANSCRIBE_SHORTCUT: KeyboardShortcut = {
  code: "KeyT",
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

const MODIFIER_ONLY_CODES = new Set([
  "AltLeft",
  "AltRight",
  "ControlLeft",
  "ControlRight",
  "MetaLeft",
  "MetaRight",
  "ShiftLeft",
  "ShiftRight",
]);

const CODE_LABELS: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Backspace: "Backspace",
  Tab: "Tab",
  Escape: "Esc",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "Page Up",
  PageDown: "Page Down",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backquote: "`",
};

function isMacPlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function normalizeKeyboardShortcut(
  shortcut: Partial<KeyboardShortcut> | undefined,
  fallback: KeyboardShortcut,
): KeyboardShortcut {
  if (!shortcut?.code) {
    return fallback;
  }

  return {
    code: shortcut.code,
    altKey: Boolean(shortcut.altKey),
    ctrlKey: Boolean(shortcut.ctrlKey),
    metaKey: Boolean(shortcut.metaKey),
    shiftKey: Boolean(shortcut.shiftKey),
  };
}

export function shortcutsEqual(
  left: KeyboardShortcut,
  right: KeyboardShortcut,
): boolean {
  return (
    left.code === right.code &&
    left.altKey === right.altKey &&
    left.ctrlKey === right.ctrlKey &&
    left.metaKey === right.metaKey &&
    left.shiftKey === right.shiftKey
  );
}

export function isValidKeyboardShortcut(shortcut: KeyboardShortcut): boolean {
  if (!shortcut.code || MODIFIER_ONLY_CODES.has(shortcut.code)) {
    return false;
  }

  return (
    shortcut.altKey ||
    shortcut.ctrlKey ||
    shortcut.metaKey ||
    shortcut.shiftKey
  );
}

export function keyboardEventToShortcut(
  event: KeyboardEvent,
): KeyboardShortcut | null {
  if (MODIFIER_ONLY_CODES.has(event.code)) {
    return null;
  }

  const shortcut: KeyboardShortcut = {
    code: event.code,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  };

  return isValidKeyboardShortcut(shortcut) ? shortcut : null;
}

export function matchesKeyboardShortcut(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut,
): boolean {
  return (
    event.code === shortcut.code &&
    event.altKey === shortcut.altKey &&
    event.ctrlKey === shortcut.ctrlKey &&
    event.metaKey === shortcut.metaKey &&
    event.shiftKey === shortcut.shiftKey
  );
}

function codeToLabel(code: string): string {
  if (code.startsWith("Key")) {
    return code.slice(3);
  }

  if (code.startsWith("Digit")) {
    return code.slice(5);
  }

  if (code.startsWith("Numpad")) {
    return code.slice(6);
  }

  return CODE_LABELS[code] ?? code;
}

function modifierLabels(shortcut: KeyboardShortcut): string[] {
  const mac = isMacPlatform();
  const labels: string[] = [];

  if (shortcut.ctrlKey) {
    labels.push("Ctrl");
  }

  if (shortcut.altKey) {
    labels.push(mac ? "Option" : "Alt");
  }

  if (shortcut.shiftKey) {
    labels.push("Shift");
  }

  if (shortcut.metaKey) {
    labels.push(mac ? "⌘" : "Win");
  }

  return labels;
}

export function formatKeyboardShortcut(shortcut: KeyboardShortcut): string {
  const parts = [...modifierLabels(shortcut), codeToLabel(shortcut.code)];
  return parts.join("+");
}

/** Map a stored shortcut to chrome.commands.update shortcut syntax. */
export function keyboardShortcutToCommandSuggestedKey(
  shortcut: KeyboardShortcut,
): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) {
    parts.push("Ctrl");
  }

  if (shortcut.altKey) {
    parts.push("Alt");
  }

  if (shortcut.metaKey) {
    parts.push("MacCtrl");
  }

  if (shortcut.shiftKey) {
    parts.push("Shift");
  }

  const key = codeToLabel(shortcut.code);
  parts.push(key.length === 1 ? key.toUpperCase() : key);

  return parts.join("+");
}
