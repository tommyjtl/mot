import { ensureOffscreenDocument } from "./offscreen-tts";
import type { SttEngineStatus } from "./stt/offscreen-stt-session";

export const OFFSCREEN_STT_START = "mot-stt-start";
export const OFFSCREEN_STT_STOP = "mot-stt-stop";
export const OFFSCREEN_STT_CANCEL = "mot-stt-cancel";
export const OFFSCREEN_STT_WARMUP = "mot-stt-warmup";
export const OFFSCREEN_STT_STATUS = "mot-stt-get-status";
export const OFFSCREEN_STT_SESSION = "mot-stt-get-session";

export type OffscreenSttStartResult =
  | { ok: true }
  | { ok: false; error: string };

async function sendOffscreenMessage<T>(message: Record<string, unknown>): Promise<T> {
  await ensureOffscreenDocument();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return (await browser.runtime.sendMessage(message)) as T;
    } catch (error) {
      if (attempt === 7) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }

  throw new Error("Offscreen document unavailable.");
}

export async function startTabTranscriptionInOffscreen(options: {
  streamId: string;
  tabId: number;
}): Promise<OffscreenSttStartResult> {
  await ensureOffscreenDocument();

  try {
    return (await browser.runtime.sendMessage({
      type: OFFSCREEN_STT_START,
      streamId: options.streamId,
      tabId: options.tabId,
    })) as OffscreenSttStartResult;
  } catch {
    return sendOffscreenMessage<OffscreenSttStartResult>({
      type: OFFSCREEN_STT_START,
      streamId: options.streamId,
      tabId: options.tabId,
    });
  }
}

export async function stopTabTranscriptionInOffscreen(): Promise<void> {
  if (!(await browser.offscreen.hasDocument())) {
    return;
  }

  try {
    await browser.runtime.sendMessage({ type: OFFSCREEN_STT_STOP });
  } catch {
    // Offscreen document may be closing.
  }
}

export async function cancelTabTranscriptionInOffscreen(): Promise<void> {
  if (!(await browser.offscreen.hasDocument())) {
    return;
  }

  try {
    await browser.runtime.sendMessage({ type: OFFSCREEN_STT_CANCEL });
  } catch {
    // Offscreen document may be closing.
  }
}

export async function warmUpOffscreenStt(): Promise<void> {
  await sendOffscreenMessage({ type: OFFSCREEN_STT_WARMUP });
}

export async function getOffscreenSttStatus(): Promise<SttEngineStatus> {
  const response = await sendOffscreenMessage<{ status: SttEngineStatus }>({
    type: OFFSCREEN_STT_STATUS,
  });
  return response.status;
}

export async function getOffscreenTranscriptionSession(): Promise<{
  active: boolean;
  tabId: number | null;
}> {
  if (!(await browser.offscreen.hasDocument())) {
    return { active: false, tabId: null };
  }

  try {
    return (await browser.runtime.sendMessage({
      type: OFFSCREEN_STT_SESSION,
    })) as { active: boolean; tabId: number | null };
  } catch {
    return { active: false, tabId: null };
  }
}
