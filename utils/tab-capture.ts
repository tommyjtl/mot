/** Tab capture must be requested synchronously from a user-gesture context. */

import type { Browser } from "wxt/browser";

export type TabCaptureErrorKind = "permission" | "stale" | "unsupported" | "other";

function classifyRawTabCaptureError(rawMessage: string): TabCaptureErrorKind {
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("not available in this tab") ||
    normalized.includes("cannot capture") ||
    normalized.includes("already captured")
  ) {
    return "stale";
  }

  if (
    normalized.includes("activetab") ||
    normalized.includes("invoked") ||
    normalized.includes("not been invoked")
  ) {
    return "permission";
  }

  if (normalized.includes("denied") || normalized.includes("permission")) {
    return "permission";
  }

  if (normalized.includes("chrome pages cannot be captured")) {
    return "unsupported";
  }

  return "other";
}

export class TabCaptureError extends Error {
  readonly rawMessage: string;
  readonly kind: TabCaptureErrorKind;

  constructor(rawMessage: string) {
    super(formatTabCaptureError(rawMessage));
    this.name = "TabCaptureError";
    this.rawMessage = rawMessage;
    this.kind = classifyRawTabCaptureError(rawMessage);
  }
}

export function formatTabCaptureError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("not available in this tab") ||
    normalized.includes("cannot capture") ||
    normalized.includes("already captured")
  ) {
    return "Tab audio is still in use from a previous capture. Press Option+T to start again, or refresh the page after stopping transcription.";
  }

  if (
    normalized.includes("activetab") ||
    normalized.includes("invoked") ||
    normalized.includes("not been invoked")
  ) {
    return "Tab capture needs a direct action on the page. Focus the tab with audio and press Option+T, or click “Allow tab audio” in the overlay.";
  }

  if (normalized.includes("denied") || normalized.includes("permission")) {
    return "Tab audio capture was denied. Focus the page with audio and try again.";
  }

  if (normalized.includes("chrome pages cannot be captured")) {
    return "This page cannot be captured. Open a normal web page with audio (e.g. YouTube).";
  }

  return message;
}

/** Minimal Chrome callback API used for synchronous tab-capture stream ids. */
type TabCaptureChrome = {
  tabCapture?: {
    getMediaStreamId?: (
      options: { targetTabId?: number },
      callback: (streamId: string | undefined) => void,
    ) => void;
  };
  runtime: {
    lastError?: { message?: string };
  };
};

function getTabCaptureChrome(): TabCaptureChrome | undefined {
  return (globalThis as typeof globalThis & { chrome?: TabCaptureChrome }).chrome;
}

/**
 * Request a tab-capture stream id via the Chrome callback API so the call
 * originates synchronously from a user-gesture handler (command / click relay).
 *
 * The call to getMediaStreamId must happen before the first `await` in the
 * caller (service worker command handler or onMessage handler).
 */
export function requestTabCaptureStreamId(
  targetTabId?: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const chromeApi = getTabCaptureChrome();
    if (!chromeApi?.tabCapture?.getMediaStreamId) {
      reject(
        new Error(
          "Tab capture API is unavailable in this extension context. Reload the extension and try again.",
        ),
      );
      return;
    }

    const options = targetTabId ? { targetTabId } : {};

    chromeApi.tabCapture.getMediaStreamId(
      options,
      (streamId: string | undefined) => {
        const err = chromeApi.runtime.lastError;
        if (err?.message) {
          reject(new TabCaptureError(err.message));
          return;
        }

        if (!streamId) {
          reject(new TabCaptureError("Tab audio capture was denied."));
          return;
        }

        resolve(streamId);
      },
    );
  });
}

/** Whether capture failed because activeTab/gesture permission was missing. */
export function isTabCapturePermissionError(error: unknown): boolean {
  if (error instanceof TabCaptureError) {
    return error.kind === "permission";
  }

  if (!(error instanceof Error)) {
    return false;
  }

  // Legacy rejections that only carried a formatted message.
  return classifyRawTabCaptureError(error.message) === "permission";
}

export function isCapturableWebTab(
  tab: Browser.tabs.Tab | undefined,
): tab is Browser.tabs.Tab & { id: number; url?: string } {
  if (!tab?.id) {
    return false;
  }

  if (tab.url) {
    return /^https?:\/\//.test(tab.url);
  }

  // Manifest commands grant activeTab for the focused tab even when url is
  // omitted. Trust the tab id and let capture fail for chrome:// pages.
  return true;
}
