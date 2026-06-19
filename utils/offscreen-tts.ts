import { arrayBufferToBase64 } from "./audio-encoding";
import type { Lang, Voice } from "./settings";

export const OFFSCREEN_SYNTHESIZE = "mot-tts-synthesize";
export const OFFSCREEN_WARMUP = "mot-tts-warmup";
export const OFFSCREEN_STATUS = "mot-tts-get-status";

export type OffscreenSynthResult =
  | {
      ok: true;
      audioBase64: string;
      text: string;
      alignment: import("./tts-types").TtsAlignment;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function ensureOffscreenDocument(): Promise<void> {
  if (await browser.offscreen.hasDocument()) {
    return;
  }

  await browser.offscreen.createDocument({
    url: browser.runtime.getURL("/offscreen.html"),
    reasons: ["AUDIO_PLAYBACK", "BLOBS"],
    justification: "Run on-device Supertonic TTS and play pronunciation audio",
  });
}

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

export async function warmUpOffscreenTts(): Promise<void> {
  await sendOffscreenMessage({ type: OFFSCREEN_WARMUP });
}

export async function synthesizeInOffscreen(options: {
  text: string;
  voice: Voice;
  lang: Lang;
  tabId: number;
  requestId: number;
  signal?: AbortSignal;
}): Promise<OffscreenSynthResult> {
  if (options.signal?.aborted) {
    throw new DOMException("Synthesis aborted", "AbortError");
  }

  return sendOffscreenMessage<OffscreenSynthResult>({
    type: OFFSCREEN_SYNTHESIZE,
    text: options.text,
    voice: options.voice,
    lang: options.lang,
    tabId: options.tabId,
    requestId: options.requestId,
  });
}

export async function playAudioInOffscreen(
  audio: ArrayBuffer,
  tabId?: number,
): Promise<void> {
  await sendOffscreenMessage({
    type: "mot-play-audio",
    audioBase64: arrayBufferToBase64(audio),
    tabId,
  });
}

export async function stopAudioInOffscreen(): Promise<void> {
  if (!(await browser.offscreen.hasDocument())) {
    return;
  }

  try {
    await browser.runtime.sendMessage({ type: "mot-stop-audio" });
  } catch {
    // Offscreen document may be closing.
  }
}

export async function abortOffscreenSynthesis(requestId: number): Promise<void> {
  if (!(await browser.offscreen.hasDocument())) {
    return;
  }

  try {
    await browser.runtime.sendMessage({
      type: "mot-tts-abort",
      requestId,
    });
  } catch {
    // Offscreen document may be closing.
  }
}

export async function getOffscreenModelStatus(): Promise<"ready" | "loading" | "idle"> {
  const response = await sendOffscreenMessage<{ status: "ready" | "loading" | "idle" }>({
    type: OFFSCREEN_STATUS,
  });
  return response.status;
}

export class TtsEngineError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "TtsEngineError";
  }
}
