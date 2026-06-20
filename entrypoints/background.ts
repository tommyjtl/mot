import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { base64ToArrayBuffer } from "../utils/audio-encoding";
import {
  clearTabSession,
  setTabSession,
} from "../utils/session";
import {
  beginTabRequest,
  getTabRequestGeneration,
  invalidateTabRequest,
  isCurrentTabRequest,
} from "../utils/tab-requests";
import { getSettings } from "../utils/settings";
import {
  abortOffscreenSynthesis,
  playAudioInOffscreen,
  stopAudioInOffscreen,
  synthesizeInOffscreen,
  TtsEngineError,
  warmUpOffscreenTts,
} from "../utils/offscreen-tts";
import { captureVisibleRegionBase64 } from "../utils/capture-screenshot";
import {
  beginCaptureWait,
  cancelCaptureWait,
  resolveCaptureWait,
} from "../utils/capture-session";
import { viewportRectToSelectionRect } from "../utils/capture-region";
import {
  recognizeInOffscreen,
  warmUpOffscreenOcr,
} from "../utils/offscreen-ocr";
import type { Message, SelectionPayload } from "../utils/messages";
import type { SelectionResult } from "../utils/selection";

async function requestSelection(
  tabId: number,
  requestId: number,
): Promise<SelectionResult> {
  try {
    const response = (await browser.tabs.sendMessage(tabId, {
      type: "speak-selection",
      requestId,
    } satisfies Message)) as Message | undefined;

    if (
      response?.type === "selection-result" &&
      response.requestId === requestId
    ) {
      return response.result;
    }
  } catch {
    // Content script may not be injected on restricted pages.
  }

  return { status: "empty" };
}

async function sendTtsResult(
  tabId: number,
  requestId: number,
  payload: Extract<Message, { type: "tts-result" }>["payload"],
): Promise<void> {
  if (!isCurrentTabRequest(tabId, requestId)) {
    return;
  }

  try {
    await browser.tabs.sendMessage(tabId, {
      type: "tts-result",
      requestId,
      payload,
    } satisfies Message);
  } catch {
    // Tab may have navigated away before playback.
  }
}

async function runOcrCaptureFlow(
  tabId: number,
  requestId: number,
  signal: AbortSignal,
): Promise<SelectionPayload | null> {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  const captureWait = beginCaptureWait(requestId);

  try {
    await browser.tabs.sendMessage(tabId, {
      type: "start-capture-mode",
      requestId,
    } satisfies Message);
  } catch {
    cancelCaptureWait(requestId);
    return null;
  }

  if (signal.aborted) {
    cancelCaptureWait(requestId);
    return null;
  }

  const region = await captureWait;
  if (!isCurrentTabRequest(tabId, requestId) || signal.aborted) {
    return null;
  }

  if (!region) {
    return null;
  }

  const rect = viewportRectToSelectionRect(region.rect);

  try {
    await browser.tabs.sendMessage(tabId, {
      type: "ocr-started",
      requestId,
      rect,
      detail: "Recognizing text…",
    } satisfies Message);
  } catch {
    return null;
  }

  try {
    const imageBase64 = await captureVisibleRegionBase64(
      tab?.windowId,
      region.rect,
      region.devicePixelRatio,
    );

    if (!isCurrentTabRequest(tabId, requestId) || signal.aborted) {
      return null;
    }

    const ocr = await recognizeInOffscreen(imageBase64);
    if (!isCurrentTabRequest(tabId, requestId) || signal.aborted) {
      return null;
    }

    if (!ocr.ok) {
      await sendTtsResult(tabId, requestId, {
        ok: false,
        error: ocr.error,
        rect,
      });
      return null;
    }

    const text = ocr.text.trim();
    if (!text) {
      await sendTtsResult(tabId, requestId, {
        ok: false,
        error: "No text found in the selected area.",
        rect,
      });
      return null;
    }

    return { text, rect };
  } catch (error) {
    if (!isCurrentTabRequest(tabId, requestId)) {
      return null;
    }

    await sendTtsResult(tabId, requestId, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not capture text from the selected area.",
      rect,
    });
    return null;
  }
}

async function handleSpeakSelection(
  tabId: number,
  requestId: number,
  signal: AbortSignal,
): Promise<void> {
  let selection = await requestSelection(tabId, requestId);

  if (!isCurrentTabRequest(tabId, requestId)) {
    return;
  }

  if (selection.status === "too_long") {
    clearTabSession(tabId);
    return;
  }

  if (selection.status === "ocr") {
    const ocrPayload = await runOcrCaptureFlow(tabId, requestId, signal);
    if (!isCurrentTabRequest(tabId, requestId)) {
      return;
    }

    if (!ocrPayload) {
      clearTabSession(tabId);
      return;
    }

    selection = { status: "ok", payload: ocrPayload };
  }

  if (selection.status === "empty") {
    await sendTtsResult(tabId, requestId, {
      ok: false,
      error: "Select some text first, then press Option+S.",
    });
    setTabSession(tabId, "active");
    return;
  }

  if (selection.status !== "ok") {
    clearTabSession(tabId);
    return;
  }

  const settings = await getSettings();

  try {
    const result = await synthesizeInOffscreen({
      text: selection.payload.text,
      voice: settings.voice,
      lang: settings.lang,
      tabId,
      requestId,
      signal,
    });

    if (!isCurrentTabRequest(tabId, requestId)) {
      return;
    }

    if (!result.ok) {
      if (result.code === "cancelled") {
        return;
      }

      throw new TtsEngineError(result.error);
    }

    await sendTtsResult(tabId, requestId, {
      ok: true,
      text: result.text,
      rect: selection.payload.rect,
      audioBase64: result.audioBase64,
      alignment: result.alignment,
    });

    if (!isCurrentTabRequest(tabId, requestId)) {
      return;
    }

    void playAudioInOffscreen(base64ToArrayBuffer(result.audioBase64), tabId).catch(
      (error: unknown) => {
        console.warn("[mot] Offscreen auto-play failed:", error);
      },
    );

    setTabSession(tabId, "active");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (isCurrentTabRequest(tabId, requestId)) {
        clearTabSession(tabId);
      }
      return;
    }

    if (!isCurrentTabRequest(tabId, requestId)) {
      return;
    }

    const message =
      error instanceof TtsEngineError
        ? error.message
        : "Could not generate pronunciation.";

    await sendTtsResult(tabId, requestId, {
      ok: false,
      text: selection.payload.text,
      rect: selection.payload.rect,
      error: message,
    });
    setTabSession(tabId, "active");
  }
}

async function preemptTabSession(tabId: number): Promise<void> {
  const previousRequestId = getTabRequestGeneration(tabId);

  void stopAudioInOffscreen();

  if (previousRequestId > 0) {
    void abortOffscreenSynthesis(previousRequestId);
  }
}

export default defineBackground(() => {
  void warmUpOffscreenTts().catch((error: unknown) => {
    console.warn("[mot] Background TTS warm-up failed:", error);
  });
  void warmUpOffscreenOcr().catch((error: unknown) => {
    console.warn("[mot] Background OCR warm-up failed:", error);
  });

  browser.runtime.onInstalled.addListener(() => {
    void warmUpOffscreenTts().catch((error: unknown) => {
      console.warn("[mot] Install TTS warm-up failed:", error);
    });
    void warmUpOffscreenOcr().catch((error: unknown) => {
      console.warn("[mot] Install OCR warm-up failed:", error);
    });
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "speak-selection") {
      return;
    }

    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      return;
    }

    await preemptTabSession(tab.id);

    const { requestId, signal } = beginTabRequest(tab.id);
    setTabSession(tab.id, "busy");

    try {
      await handleSpeakSelection(tab.id, requestId, signal);
    } catch {
      if (isCurrentTabRequest(tab.id, requestId)) {
        clearTabSession(tab.id);
      }
    }
  });

  browser.runtime.onMessage.addListener(async (message: Message, sender) => {
    if (message.type === "stop-audio") {
      void stopAudioInOffscreen();
      return;
    }

    if (message.type === "play-audio") {
      const tabId = sender.tab?.id;
      void playAudioInOffscreen(
        base64ToArrayBuffer(message.audioBase64),
        tabId,
      ).catch((error: unknown) => {
        console.warn("[mot] Offscreen playback failed:", error);
      });
      return;
    }

    if (message.type === "mot-playback-relay") {
      void browser.tabs
        .sendMessage(message.tabId, {
          type: "tts-playback",
          state: message.state,
          currentTime: message.currentTime,
          duration: message.duration,
        } satisfies Message)
        .catch(() => {
          // Tab may have navigated away.
        });
      return;
    }

    if (message.type === "speak-word") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        return;
      }

      await stopAudioInOffscreen();
      await abortOffscreenSynthesis(0);

      const settings = await getSettings();

      try {
        const result = await synthesizeInOffscreen({
          text: message.word,
          voice: settings.voice,
          lang: settings.lang,
          tabId,
          requestId: message.requestId,
        });

        if (!result.ok) {
          await browser.tabs.sendMessage(tabId, {
            type: "word-tts-result",
            requestId: message.requestId,
            wordIndex: message.wordIndex,
            endWordIndex: message.endWordIndex,
            payload: { ok: false, error: result.error },
          } satisfies Message);
          return;
        }

        await browser.tabs.sendMessage(tabId, {
          type: "word-tts-result",
          requestId: message.requestId,
          wordIndex: message.wordIndex,
          endWordIndex: message.endWordIndex,
          payload: {
            ok: true,
            word: result.text,
            audioBase64: result.audioBase64,
            alignment: result.alignment,
          },
        } satisfies Message);

        void playAudioInOffscreen(
          base64ToArrayBuffer(result.audioBase64),
          tabId,
        ).catch((error: unknown) => {
          console.warn("[mot] Word playback failed:", error);
        });
      } catch (error) {
        const errorMessage =
          error instanceof TtsEngineError
            ? error.message
            : "Could not generate word pronunciation.";

        try {
          await browser.tabs.sendMessage(tabId, {
            type: "word-tts-result",
            requestId: message.requestId,
            wordIndex: message.wordIndex,
            endWordIndex: message.endWordIndex,
            payload: { ok: false, error: errorMessage },
          } satisfies Message);
        } catch {
          // Tab may have navigated away.
        }
      }

      return;
    }

    if (message.type === "capture-region-selected") {
      resolveCaptureWait(message.requestId, message.selection);
      return;
    }

    if (message.type === "session-idle") {
      let tabId = sender.tab?.id;

      if (!tabId) {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = tab?.id;
      }

      if (tabId) {
        const cancelledRequestId = invalidateTabRequest(tabId);
        clearTabSession(tabId);
        void stopAudioInOffscreen();

        if (cancelledRequestId !== null) {
          cancelCaptureWait(cancelledRequestId);
          try {
            await browser.tabs.sendMessage(tabId, {
              type: "request-cancelled",
              requestId: cancelledRequestId,
            } satisfies Message);
          } catch {
            // Tab may have navigated away.
          }
        }
      }
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    invalidateTabRequest(tabId);
    clearTabSession(tabId);
  });
});
