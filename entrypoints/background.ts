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
import type { Message } from "../utils/messages";
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

async function handleSpeakSelection(
  tabId: number,
  requestId: number,
  signal: AbortSignal,
): Promise<void> {
  const selection = await requestSelection(tabId, requestId);

  if (!isCurrentTabRequest(tabId, requestId)) {
    return;
  }

  if (selection.status === "too_long") {
    clearTabSession(tabId);
    return;
  }

  if (selection.status === "empty") {
    await sendTtsResult(tabId, requestId, {
      ok: false,
      error: "Select some text first, then press Option+S.",
    });
    setTabSession(tabId, "active");
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

  browser.runtime.onInstalled.addListener(() => {
    void warmUpOffscreenTts().catch((error: unknown) => {
      console.warn("[mot] Install TTS warm-up failed:", error);
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

      void stopAudioInOffscreen();
      void abortOffscreenSynthesis(0);

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
            payload: { ok: false, error: result.error },
          } satisfies Message);
          return;
        }

        await browser.tabs.sendMessage(tabId, {
          type: "word-tts-result",
          requestId: message.requestId,
          wordIndex: message.wordIndex,
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
            payload: { ok: false, error: errorMessage },
          } satisfies Message);
        } catch {
          // Tab may have navigated away.
        }
      }

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
