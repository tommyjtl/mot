import { arrayBufferToBase64, base64ToArrayBuffer } from "./audio-encoding";
import {
  broadcastModelLoadError,
  broadcastModelLoadProgress,
} from "./model-load-broadcast";
import type { Lang, Voice } from "./settings";
import {
  OFFSCREEN_STATUS,
  OFFSCREEN_SYNTHESIZE,
  OFFSCREEN_WARMUP,
} from "./offscreen-tts";
import {
  OFFSCREEN_OCR,
  OFFSCREEN_OCR_WARMUP,
} from "./offscreen-ocr";
import {
  recognizeFrenchFromBase64,
  warmUpOcrEngine,
} from "./ocr/tesseract-engine";
import {
  OFFSCREEN_STT_START,
  OFFSCREEN_STT_STOP,
  OFFSCREEN_STT_CANCEL,
  OFFSCREEN_STT_STATUS,
  OFFSCREEN_STT_SESSION,
  OFFSCREEN_STT_WARMUP,
} from "./offscreen-stt";
import {
  getSttEngineStatus,
  isTranscriptionActive,
  startTabTranscription,
  stopTabTranscription,
  cancelTabTranscription,
  transcriptionTabId,
  warmUpSttEngine,
} from "./stt/offscreen-stt-session";
import {
  synthesizeLocally,
  warmUpTtsEngine,
  getEngineStatus,
  type TtsProgress,
} from "./supertonic/engine";

export const PLAY_AUDIO = "mot-play-audio";
export const STOP_AUDIO = "mot-stop-audio";
/** How often to relay playback position while audio is playing (~20 Hz). */
const PLAYBACK_TICK_MS = 50;

let activeSynthRequestId = 0;

function relayModelProgress(progress: TtsProgress): void {
  if (progress.phase === "loading-model") {
    broadcastModelLoadProgress(progress);
    return;
  }
}

async function notifyTabProgress(
  tabId: number,
  requestId: number,
  progress: TtsProgress,
): Promise<void> {
  relayModelProgress(progress);

  try {
    await browser.tabs.sendMessage(tabId, {
      type: "tts-progress",
      requestId,
      phase: progress.phase,
      detail: progress.detail,
      percent: "percent" in progress ? progress.percent : undefined,
    });
  } catch {
    // Tab may not be ready yet.
  }
}

export function setupOffscreenDocument(): void {
  let currentAudio: HTMLAudioElement | null = null;
  let currentAudioUrl: string | null = null;
  let playbackTabId: number | undefined;
  let playbackTickTimer: ReturnType<typeof setInterval> | null = null;

  function stopPlaybackTicks(): void {
    if (playbackTickTimer !== null) {
      clearInterval(playbackTickTimer);
      playbackTickTimer = null;
    }
  }

  function startPlaybackTicks(tabId: number | undefined): void {
    stopPlaybackTicks();
    playbackTabId = tabId;

    playbackTickTimer = setInterval(() => {
      if (!currentAudio || currentAudio.paused || currentAudio.ended) {
        return;
      }

      notifyPlayback(playbackTabId, "timeupdate");
    }, PLAYBACK_TICK_MS);
  }

  function stopAudio(): void {
    stopPlaybackTicks();

    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onpause = null;
      currentAudio.onloadedmetadata = null;
      currentAudio.onplay = null;
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }

    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }
  }

  function notifyPlayback(
    tabId: number | undefined,
    state: "playing" | "timeupdate" | "paused" | "ended",
  ): void {
    if (!tabId || !currentAudio) {
      return;
    }

    void browser.runtime
      .sendMessage({
        type: "mot-playback-relay",
        tabId,
        state,
        currentTime: currentAudio.currentTime,
        duration: Number.isFinite(currentAudio.duration)
          ? currentAudio.duration
          : 0,
      })
      .catch(() => {
        // Background may be unavailable during reload.
      });
  }

  function bindPlaybackEvents(tabId: number | undefined): void {
    if (!currentAudio) {
      return;
    }

    currentAudio.onloadedmetadata = () => {
      notifyPlayback(tabId, "timeupdate");
    };

    currentAudio.onplay = () => {
      notifyPlayback(tabId, "playing");
      startPlaybackTicks(tabId);
    };

    currentAudio.onpause = () => {
      if (currentAudio?.ended) {
        return;
      }

      stopPlaybackTicks();
      notifyPlayback(tabId, "paused");
    };

    currentAudio.onended = () => {
      stopPlaybackTicks();
      notifyPlayback(tabId, "ended");
    };
  }

  function loadAudioFromBase64(
    audioBase64: string,
    tabId: number | undefined,
  ): void {
    stopAudio();

    const buffer = base64ToArrayBuffer(audioBase64);
    const blob = new Blob([buffer], { type: "audio/wav" });
    currentAudioUrl = URL.createObjectURL(blob);
    currentAudio = new Audio(currentAudioUrl);
    bindPlaybackEvents(tabId);

    const playFromStart = (): void => {
      if (!currentAudio) {
        return;
      }

      void currentAudio.play().catch((error: unknown) => {
        console.error("[mot] Offscreen audio playback failed:", error);
      });
    };

    if (currentAudio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      playFromStart();
      return;
    }

    currentAudio.addEventListener("loadedmetadata", () => playFromStart(), {
      once: true,
    });
  }

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === OFFSCREEN_WARMUP) {
      void warmUpTtsEngine((progress) => {
        relayModelProgress(progress);
      })
        .then(() => {
          broadcastModelLoadProgress({
            phase: "ready",
            detail: "Model ready",
          });
          sendResponse({ ok: true });
        })
        .catch((error: unknown) => {
          const detail =
            error instanceof Error ? error.message : "Warm-up failed";
          broadcastModelLoadError(detail);
          sendResponse({ ok: false, error: detail });
        });
      return true;
    }

    if (message?.type === OFFSCREEN_STATUS) {
      void getEngineStatus().then((status) => sendResponse({ status }));
      return true;
    }

    if (message?.type === "mot-tts-abort") {
      if (
        message.requestId === 0 ||
        message.requestId === activeSynthRequestId
      ) {
        activeSynthRequestId = 0;
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === STOP_AUDIO) {
      stopAudio();
      return false;
    }

    if (message?.type === PLAY_AUDIO && message.audioBase64) {
      loadAudioFromBase64(message.audioBase64, message.tabId as number | undefined);
      return false;
    }

    if (message?.type === OFFSCREEN_OCR_WARMUP) {
      void warmUpOcrEngine()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "OCR warm-up failed",
          });
        });
      return true;
    }

    if (message?.type === OFFSCREEN_OCR) {
      const { imageBase64 } = message as { imageBase64: string };
      void recognizeFrenchFromBase64(imageBase64)
        .then((text) => sendResponse({ ok: true, text }))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "OCR failed",
          });
        });
      return true;
    }

    if (message?.type === OFFSCREEN_STT_START) {
      const { streamId, tabId } = message as {
        streamId: string;
        tabId: number;
      };

      void startTabTranscription(streamId, tabId)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error:
              error instanceof Error ? error.message : "Transcription failed",
          });
        });
      return true;
    }

    if (message?.type === OFFSCREEN_STT_WARMUP) {
      void warmUpSttEngine()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Speech model warm-up failed",
          });
        });
      return true;
    }

    if (message?.type === OFFSCREEN_STT_STATUS) {
      sendResponse({ status: getSttEngineStatus() });
      return false;
    }

    if (message?.type === OFFSCREEN_STT_SESSION) {
      sendResponse({
        active: isTranscriptionActive(),
        tabId: transcriptionTabId(),
      });
      return false;
    }

    if (message?.type === OFFSCREEN_STT_STOP) {
      void stopTabTranscription().then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message?.type === OFFSCREEN_STT_CANCEL) {
      void cancelTabTranscription().then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message?.type !== OFFSCREEN_SYNTHESIZE) {
      return false;
    }

    const { text, voice, lang, tabId, requestId } = message as {
      text: string;
      voice: Voice;
      lang: Lang;
      tabId: number;
      requestId: number;
    };

    activeSynthRequestId = requestId;

    void synthesizeLocally({ text, voice, lang }, (progress) => {
      if (activeSynthRequestId !== requestId) {
        return;
      }
      void notifyTabProgress(tabId, requestId, progress);
    })
      .then((result) => {
        if (activeSynthRequestId !== requestId) {
          sendResponse({ ok: false, error: "Request cancelled", code: "cancelled" });
          return;
        }

        broadcastModelLoadProgress({
          phase: "ready",
          detail: "Model ready",
        });

        sendResponse({
          ok: true,
          audioBase64: arrayBufferToBase64(result.audio),
          text: result.text,
          alignment: result.alignment,
        });
      })
      .catch((error: unknown) => {
        if (activeSynthRequestId !== requestId) {
          sendResponse({ ok: false, error: "Request cancelled", code: "cancelled" });
          return;
        }

        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Synthesis failed",
        });
      });

    return true;
  });
}
