import {
  DEFAULT_SPEAK_SHORTCUT,
  DEFAULT_TRANSCRIBE_SHORTCUT,
  normalizeKeyboardShortcut,
  type KeyboardShortcut,
} from "./keyboard-shortcut";
import { getSettings, STORAGE_KEY } from "./settings";

let speakShortcut: KeyboardShortcut = DEFAULT_SPEAK_SHORTCUT;
let transcribeShortcut: KeyboardShortcut = DEFAULT_TRANSCRIBE_SHORTCUT;
let initialized = false;

export async function initShortcutRuntime(): Promise<void> {
  const settings = await getSettings();
  speakShortcut = normalizeKeyboardShortcut(
    settings.speakShortcut,
    DEFAULT_SPEAK_SHORTCUT,
  );
  transcribeShortcut = normalizeKeyboardShortcut(
    settings.transcribeShortcut,
    DEFAULT_TRANSCRIBE_SHORTCUT,
  );
  initialized = true;
}

export function bindShortcutSettingsSync(): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" && area !== "local") {
      return;
    }

    if (!changes[STORAGE_KEY]) {
      return;
    }

    void initShortcutRuntime();
  });
}

export function getSpeakShortcut(): KeyboardShortcut {
  return speakShortcut;
}

export function getTranscribeShortcut(): KeyboardShortcut {
  return transcribeShortcut;
}

export function isShortcutRuntimeReady(): boolean {
  return initialized;
}
