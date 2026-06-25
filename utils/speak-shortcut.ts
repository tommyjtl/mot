import { matchesKeyboardShortcut } from "./keyboard-shortcut";
import { getSpeakShortcut } from "./shortcut-runtime";

/** Physical shortcut match — use `code`, not `key` (Option+S may emit "ß" on Mac). */
export function isSpeakSelectionShortcut(event: KeyboardEvent): boolean {
  return matchesKeyboardShortcut(event, getSpeakShortcut());
}
