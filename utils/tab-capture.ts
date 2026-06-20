/** Tab capture must be requested synchronously from a user-gesture context. */

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
    const chromeApi = globalThis.chrome;
    if (!chromeApi?.tabCapture?.getMediaStreamId) {
      reject(new Error("Tab capture is not available in this browser."));
      return;
    }

    const options = targetTabId ? { targetTabId } : {};

    chromeApi.tabCapture.getMediaStreamId(
      options,
      (streamId: string | undefined) => {
        const err = chromeApi.runtime.lastError;
        if (err?.message) {
          reject(new Error(formatTabCaptureError(err.message)));
          return;
        }

        if (!streamId) {
          reject(new Error("Tab audio capture was denied."));
          return;
        }

        resolve(streamId);
      },
    );
  });
}

export function isTabCapturePermissionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("activetab") ||
    normalized.includes("invoked") ||
    normalized.includes("denied") ||
    normalized.includes("permission") ||
    normalized.includes("not been invoked") ||
    normalized.includes("not available in this tab")
  );
}
