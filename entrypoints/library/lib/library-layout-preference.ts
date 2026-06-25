export type LibraryLayout = "list" | "cards";

const STORAGE_KEY = "motLibraryLayout";
const DEFAULT_LAYOUT: LibraryLayout = "list";

export async function getLibraryLayoutPreference(): Promise<LibraryLayout> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY];

  if (value === "list" || value === "cards") {
    return value;
  }

  return DEFAULT_LAYOUT;
}

export async function setLibraryLayoutPreference(
  layout: LibraryLayout,
): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: layout });
}
