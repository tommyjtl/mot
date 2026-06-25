import { browser } from "wxt/browser";
import type { Message } from "./messages";

export function libraryPageUrl(entryNormalized?: string): string {
  const params = entryNormalized
    ? `?entry=${encodeURIComponent(entryNormalized)}`
    : "";
  return browser.runtime.getURL(`library.html${params}`);
}

export async function openLibraryTab(entryNormalized?: string): Promise<void> {
  await browser.runtime.sendMessage({
    type: "open-library",
    entry: entryNormalized,
  } satisfies Message);
}
