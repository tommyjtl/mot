/** Physical Alt+Option+S — use `code`, not `key` (Option+S may emit "ß" on Mac). */
export function isSpeakSelectionShortcut(event: KeyboardEvent): boolean {
  return (
    event.code === "KeyS" &&
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}
