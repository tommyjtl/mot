import { matchesKeyboardShortcut } from "./keyboard-shortcut";
import { getTranscribeShortcut } from "./shortcut-runtime";

/** Physical shortcut match — use `code`, not `key` (Option+T may emit special chars on Mac). */
export function isTranscribeShortcut(event: KeyboardEvent): boolean {
  return matchesKeyboardShortcut(event, getTranscribeShortcut());
}
