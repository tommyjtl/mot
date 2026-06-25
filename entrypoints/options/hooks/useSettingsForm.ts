import { useCallback, useEffect, useState } from "react";
import {
  getSettings,
  saveSettings,
  type Lang,
  type Voice,
} from "@/utils/settings";

export function useSettingsForm() {
  const [voice, setVoice] = useState<Voice>("F1");
  const [lang, setLang] = useState<Lang>("fr");
  const [saveMessage, setSaveMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getSettings().then((settings) => {
      setVoice(settings.voice);
      setLang(settings.lang);
      setLoading(false);
    });
  }, []);

  const save = useCallback(async () => {
    const current = await getSettings();
    await saveSettings({
      ...current,
      voice,
      lang,
    });
    setSaveMessage("Settings saved.");
    window.setTimeout(() => {
      setSaveMessage("");
    }, 2000);
  }, [voice, lang]);

  return {
    voice,
    lang,
    setVoice,
    setLang,
    saveMessage,
    loading,
    save,
  };
}
