import { browser } from "wxt/browser";
import type { Message } from "./messages";

export function libraryPageUrl(entryNormalized?: string): string {
  const params = entryNormalized
    ? `?entry=${encodeURIComponent(entryNormalized)}`
    : "";
  return browser.runtime.getURL(`library.html${params}`);
}

export function getLibraryEntryParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  const entry = params.get("entry");
  return entry?.trim() ? entry : null;
}

export function setLibraryEntryParam(
  entryNormalized: string | null | undefined,
): void {
  const url = new URL(window.location.href);
  const nextEntry = entryNormalized?.trim();

  if (nextEntry) {
    url.searchParams.set("entry", nextEntry);
  } else {
    url.searchParams.delete("entry");
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

export async function openLibraryTab(entryNormalized?: string): Promise<void> {
  await browser.runtime.sendMessage({
    type: "open-library",
    entry: entryNormalized,
  } satisfies Message);
}
