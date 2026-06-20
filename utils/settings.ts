export type Voice = "M1" | "F1";
export type Lang = "fr" | "na";

export type MotSettings = {
  voice: Voice;
  lang: Lang;
};

export const DEFAULT_SETTINGS: MotSettings = {
  voice: "F1",
  lang: "fr",
};

const STORAGE_KEY = "motSettings";

export async function getSettings(): Promise<MotSettings> {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<MotSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function saveSettings(settings: MotSettings): Promise<void> {
  await browser.storage.sync.set({ [STORAGE_KEY]: settings });
}
