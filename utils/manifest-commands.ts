import { browser } from "wxt/browser";
import {
  DEFAULT_SPEAK_SHORTCUT,
  DEFAULT_TRANSCRIBE_SHORTCUT,
  formatKeyboardShortcut,
  keyboardShortcutToCommandSuggestedKey,
  normalizeKeyboardShortcut,
} from "./keyboard-shortcut";
import { motifLog, motifWarn } from "./motif-log";
import { getSettings, STORAGE_KEY } from "./settings";

export const SPEAK_COMMAND = "speak-selection";
export const TRANSCRIBE_COMMAND = "transcribe-tab";

export async function logRegisteredCommands(label: string): Promise<void> {
  if (!browser.commands?.getAll) {
    motifWarn("commands", "chrome.commands.getAll is unavailable");
    return;
  }

  const commands = await browser.commands.getAll();
  motifLog("commands", label, {
    commands: commands.map((command) => ({
      name: command.name,
      shortcut: command.shortcut ?? "(not assigned)",
      description: command.description,
    })),
  });

  const transcribe = commands.find((command) => command.name === TRANSCRIBE_COMMAND);
  if (transcribe && !transcribe.shortcut) {
    motifWarn(
      "commands",
      `${TRANSCRIBE_COMMAND} has no Chrome shortcut assigned — open chrome://extensions/shortcuts and assign one manually`,
    );
  }
}

async function syncCommandShortcut(
  name: string,
  shortcut: ReturnType<typeof normalizeKeyboardShortcut>,
): Promise<void> {
  if (!browser.commands?.update) {
    motifWarn("commands", `chrome.commands.update unavailable; cannot sync ${name}`);
    return;
  }

  const chromeShortcut = keyboardShortcutToCommandSuggestedKey(shortcut);
  const displayShortcut = formatKeyboardShortcut(shortcut);

  try {
    await browser.commands.update({
      name,
      shortcut: chromeShortcut,
    });
    motifLog("commands", `Synced ${name}`, {
      displayShortcut,
      chromeShortcut,
    });
  } catch (error: unknown) {
    motifWarn("commands", `Could not sync shortcut for ${name}`, {
      displayShortcut,
      chromeShortcut,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function syncManifestCommands(): Promise<void> {
  await logRegisteredCommands("Before sync");

  const settings = await getSettings();

  await syncCommandShortcut(
    SPEAK_COMMAND,
    normalizeKeyboardShortcut(settings.speakShortcut, DEFAULT_SPEAK_SHORTCUT),
  );
  await syncCommandShortcut(
    TRANSCRIBE_COMMAND,
    normalizeKeyboardShortcut(
      settings.transcribeShortcut,
      DEFAULT_TRANSCRIBE_SHORTCUT,
    ),
  );

  await logRegisteredCommands("After sync");
}

/** @deprecated Use syncManifestCommands */
export async function syncTranscribeManifestCommand(): Promise<void> {
  await syncManifestCommands();
}

export function bindManifestCommandSync(): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" && area !== "local") {
      return;
    }

    if (!changes[STORAGE_KEY]) {
      return;
    }

    void syncManifestCommands();
  });
}

/** @deprecated Use bindManifestCommandSync */
export function bindTranscribeCommandSync(): void {
  bindManifestCommandSync();
}
