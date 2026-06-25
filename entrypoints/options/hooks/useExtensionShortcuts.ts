import { useCallback, useEffect, useState } from "react";
import {
  getSettings,
  saveSettings,
  type MotSettings,
} from "@/utils/settings";
import {
  DEFAULT_SPEAK_SHORTCUT,
  DEFAULT_TRANSCRIBE_SHORTCUT,
  type KeyboardShortcut,
} from "@/utils/keyboard-shortcut";

export function useExtensionShortcuts() {
  const [speakShortcut, setSpeakShortcut] =
    useState<KeyboardShortcut>(DEFAULT_SPEAK_SHORTCUT);
  const [transcribeShortcut, setTranscribeShortcut] =
    useState<KeyboardShortcut>(DEFAULT_TRANSCRIBE_SHORTCUT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getSettings().then((settings) => {
      setSpeakShortcut(settings.speakShortcut);
      setTranscribeShortcut(settings.transcribeShortcut);
      setLoading(false);
    });
  }, []);

  const persist = useCallback(
    async (partial: Pick<Partial<MotSettings>, "speakShortcut" | "transcribeShortcut">) => {
      const current = await getSettings();
      await saveSettings({
        ...current,
        ...partial,
      });
    },
    [],
  );

  const updateSpeakShortcut = useCallback(
    (shortcut: KeyboardShortcut) => {
      setSpeakShortcut(shortcut);
      void persist({ speakShortcut: shortcut });
    },
    [persist],
  );

  const updateTranscribeShortcut = useCallback(
    (shortcut: KeyboardShortcut) => {
      setTranscribeShortcut(shortcut);
      void persist({ transcribeShortcut: shortcut });
    },
    [persist],
  );

  return {
    speakShortcut,
    transcribeShortcut,
    setSpeakShortcut: updateSpeakShortcut,
    setTranscribeShortcut: updateTranscribeShortcut,
    loading,
  };
}
