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
import {
  startTabTranscriptionInOffscreen,
  stopTabTranscriptionInOffscreen,
  cancelTabTranscriptionInOffscreen,
  getOffscreenTranscriptionSession,
} from "../utils/offscreen-stt";
import {
  isCapturableWebTab,
  isTabCapturePermissionError,
  requestTabCaptureStreamId,
} from "../utils/tab-capture";
import {
  bindManifestCommandSync,
  logRegisteredCommands,
  SPEAK_COMMAND,
  syncManifestCommands,
  TRANSCRIBE_COMMAND,
} from "../utils/manifest-commands";
import { formatKeyboardShortcut } from "../utils/keyboard-shortcut";
import { motifLog, motifWarn } from "../utils/motif-log";
import type { Message, SelectionPayload } from "../utils/messages";
import type { SelectionResult } from "../utils/selection";
import {
  addVocabContext,
  createVocabEntry,
  deleteVocabContext,
  exportVocab,
  importVocab,
  lookupVocabEntry,
  updateVocabNote,
} from "../utils/vocab/vocab-store";

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
        console.warn("[motif] Offscreen auto-play failed:", error);
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

let lastSpeakSelectionTabId = -1;
let lastSpeakSelectionAt = 0;

async function beginSpeakSelection(tabId: number): Promise<void> {
  const now = Date.now();
  if (tabId === lastSpeakSelectionTabId && now - lastSpeakSelectionAt < 400) {
    return;
  }

  lastSpeakSelectionTabId = tabId;
  lastSpeakSelectionAt = now;

  await preemptTabSession(tabId);

  const { requestId, signal } = beginTabRequest(tabId);
  setTabSession(tabId, "busy");

  try {
    await handleSpeakSelection(tabId, requestId, signal);
  } catch {
    if (isCurrentTabRequest(tabId, requestId)) {
      clearTabSession(tabId);
    }
  }
}

async function preemptTabSession(tabId: number): Promise<void> {
  if (transcriptionTabId === tabId) {
    await stopTranscription();
  }

  const previousRequestId = getTabRequestGeneration(tabId);

  void stopAudioInOffscreen();

  if (previousRequestId > 0) {
    void abortOffscreenSynthesis(previousRequestId);
  }
}

let transcriptionTabId: number | null = null;
let lastTranscribeInvoke: { tabId: number; at: number } | null = null;

function shouldDedupeTranscribeInvoke(tabId: number, source: string): boolean {
  const now = Date.now();
  if (
    lastTranscribeInvoke &&
    lastTranscribeInvoke.tabId === tabId &&
    now - lastTranscribeInvoke.at < 400
  ) {
    motifLog("transcribe", "Ignoring duplicate invoke", { tabId, source });
    return true;
  }

  lastTranscribeInvoke = { tabId, at: now };
  return false;
}

async function getTranscriptionTabMeta(tabId: number | null): Promise<{
  tabTitle?: string;
  tabUrl?: string;
}> {
  if (tabId === null) {
    return {};
  }

  try {
    const tab = await browser.tabs.get(tabId);
    return { tabTitle: tab.title, tabUrl: tab.url };
  } catch {
    return {};
  }
}

function broadcastTranscriptionState(error?: string): void {
  void (async () => {
    const meta = await getTranscriptionTabMeta(transcriptionTabId);

    void browser.runtime
      .sendMessage({
        type: "transcription-state-changed",
        active: transcriptionTabId !== null,
        tabId: transcriptionTabId,
        tabTitle: meta.tabTitle,
        tabUrl: meta.tabUrl,
        error,
      } satisfies Message)
      .catch(() => {
        // Options page may be closed.
      });
  })();
}

function pickWebTab(tabs: browser.tabs.Tab[]): browser.tabs.Tab | null {
  const webTabs = tabs.filter(
    (tab) => tab.id && tab.url && /^https?:\/\//.test(tab.url),
  );

  const activeWeb = webTabs.find((tab) => tab.active);
  return activeWeb ?? webTabs[0] ?? null;
}

async function findTranscriptionTargetTab() {
  if (transcriptionTabId !== null) {
    try {
      const tab = await browser.tabs.get(transcriptionTabId);
      if (tab.id && tab.url && /^https?:\/\//.test(tab.url)) {
        return tab;
      }
    } catch {
      transcriptionTabId = null;
    }
  }

  const lastFocused = await browser.tabs.query({ lastFocusedWindow: true });
  const fromLastFocused = pickWebTab(lastFocused);
  if (fromLastFocused) {
    return fromLastFocused;
  }

  const allTabs = await browser.tabs.query({});
  return pickWebTab(allTabs);
}

async function toggleTranscription(
  tab?: Awaited<ReturnType<typeof findTranscriptionTargetTab>>,
  streamId?: string,
): Promise<{
  ok: boolean;
  active: boolean;
  error?: string;
  tabId?: number;
  pendingCapture?: boolean;
}> {
  const target = tab ?? (await findTranscriptionTargetTab());

  if (!target?.id) {
    return {
      ok: false,
      active: false,
      error:
        "No web page tab found. Open a page with audio (e.g. YouTube) in this window.",
    };
  }

  if (transcriptionTabId === target.id) {
    await stopTranscription();
    return { ok: true, active: false, tabId: target.id };
  }

  if (streamId) {
    return startTranscriptionWithCapture(target.id, streamId);
  }

  try {
    await promptTranscriptionCapture(
      target.id,
      "Click Allow tab audio on the page to start transcription.",
    );
    return { ok: true, active: false, tabId: target.id, pendingCapture: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Could not start transcription.";
    return { ok: false, active: false, error: message, tabId: target.id };
  }
}

async function notifyTranscriptStopped(tabId: number | null): Promise<void> {
  if (tabId === null) {
    return;
  }

  try {
    await browser.tabs.sendMessage(tabId, {
      type: "transcript-stopped",
    } satisfies Message);
  } catch {
    // Tab may have navigated away.
  }
}

async function stopTranscription(): Promise<void> {
  const tabId = transcriptionTabId;
  transcriptionTabId = null;
  await stopTabTranscriptionInOffscreen();
  await notifyTranscriptStopped(tabId);
  broadcastTranscriptionState();
}

async function dismissTranscription(): Promise<void> {
  transcriptionTabId = null;
  await cancelTabTranscriptionInOffscreen();
  broadcastTranscriptionState();
}

async function notifyTranscriptError(
  tabId: number,
  message: string,
): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, {
      type: "transcript-error",
      message,
    } satisfies Message);
  } catch {
    // Tab may not allow content scripts.
  }
}

async function promptTranscriptionCapture(
  tabId: number,
  message?: string,
  options?: { preserveLines?: boolean },
): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, {
      type: "transcript-request-capture",
      tabId,
      message,
      preserveLines: options?.preserveLines,
    } satisfies Message);
  } catch {
    throw new Error("Could not reach this page. Refresh the tab and try again.");
  }
}

async function startTranscription(
  tabId: number,
  streamId: string,
): Promise<void> {
  transcriptionTabId = tabId;

  try {
    await browser.tabs.sendMessage(tabId, {
      type: "transcript-started",
    } satisfies Message);
  } catch {
    // Overlay is optional for capture; offscreen may still succeed.
  }

  const result = await startTabTranscriptionInOffscreen({
    streamId,
    tabId,
  });

  if (!result.ok) {
    transcriptionTabId = null;
    throw new Error(result.error);
  }
}

async function startTranscriptionWithCapture(
  tabId: number,
  streamId: string,
): Promise<{
  ok: boolean;
  active: boolean;
  error?: string;
  tabId?: number;
}> {
  if (transcriptionTabId !== null && transcriptionTabId !== tabId) {
    await stopTranscription();
  }

  // Ensure any lingering offscreen capture is fully released before reusing the tab.
  await stopTabTranscriptionInOffscreen();

  void stopAudioInOffscreen();

  try {
    await startTranscription(tabId, streamId);
    broadcastTranscriptionState();
    return { ok: true, active: true, tabId };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Could not start transcription.";

    transcriptionTabId = null;
    await stopTabTranscriptionInOffscreen();
    broadcastTranscriptionState(message);
    await notifyTranscriptError(tabId, message);

    return { ok: false, active: false, error: message, tabId };
  }
}

async function handleSpeakWordMessage(
  message: Extract<Message, { type: "speak-word" }>,
  tabId: number,
): Promise<void> {
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
      console.warn("[motif] Word playback failed:", error);
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
}

async function handleSessionIdle(
  senderTabId: number | undefined,
): Promise<void> {
  let tabId = senderTabId;

  if (!tabId) {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    tabId = tab?.id;
  }

  if (!tabId) {
    return;
  }

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

function isVocabMessageType(type: string | undefined): boolean {
  return (
    type === "vocab-lookup" ||
    type === "vocab-create" ||
    type === "vocab-add-context" ||
    type === "vocab-update-note" ||
    type === "vocab-delete-context" ||
    type === "vocab-export" ||
    type === "vocab-import"
  );
}

async function showTranscriptStartedOverlay(tabId: number): Promise<boolean> {
  motifLog("transcribe", "Sending transcript-started to tab", { tabId });

  try {
    await browser.tabs.sendMessage(tabId, {
      type: "transcript-started",
    } satisfies Message);
    motifLog("transcribe", "transcript-started delivered", { tabId });
    return true;
  } catch (error: unknown) {
    motifWarn("transcribe", "transcript-started failed — is the page refreshed?", {
      tabId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function beginTranscriptionCapture(
  tabId: number,
  streamIdPromise: Promise<string>,
  source: string,
): Promise<void> {
  motifLog("transcribe", "beginTranscriptionCapture", { tabId, source });

  const overlayShown = await showTranscriptStartedOverlay(tabId);

  try {
    motifLog("transcribe", "Awaiting tab capture stream id", { tabId });
    const streamId = await streamIdPromise;
    motifLog("transcribe", "Tab capture stream id received", {
      tabId,
      streamIdLength: streamId.length,
    });

    const result = await startTranscriptionWithCapture(tabId, streamId);
    motifLog("transcribe", "startTranscriptionWithCapture finished", {
      tabId,
      ok: result.ok,
      active: result.active,
      error: result.error,
    });

    if (!result.ok && result.error) {
      await notifyTranscriptError(tabId, result.error);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Tab audio capture was denied.";

    motifWarn("transcribe", "Tab capture failed", { tabId, message, overlayShown });

    if (isTabCapturePermissionError(error)) {
      if (!overlayShown) {
        await browser.tabs.update(tabId, { active: true }).catch(() => {});
      }

      try {
        motifLog("transcribe", "Prompting for manual tab capture", { tabId });
        await promptTranscriptionCapture(tabId, message);
      } catch (promptError: unknown) {
        motifWarn("transcribe", "Manual capture prompt failed", {
          tabId,
          error:
            promptError instanceof Error
              ? promptError.message
              : String(promptError),
        });
        await notifyTranscriptError(
          tabId,
          overlayShown
            ? message
            : "Could not reach this page. Refresh the tab and try again.",
        );
      }
      return;
    }

    await notifyTranscriptError(tabId, message);
  }
}

async function handleTranscribeCommandWithoutCapturableTab(
  source: string,
): Promise<void> {
  motifLog("transcribe", "No capturable active tab; searching for a web tab", {
    source,
  });

  if (transcriptionTabId !== null) {
    motifLog("transcribe", "Stopping active transcription", {
      tabId: transcriptionTabId,
    });
    await stopTranscription();
    return;
  }

  const target = await findTranscriptionTargetTab();
  if (!target?.id) {
    motifWarn(
      "transcribe",
      "No web page tab found. Open a page with audio (e.g. YouTube) and try again.",
    );
    return;
  }

  motifLog("transcribe", "Focusing fallback web tab", {
    tabId: target.id,
    url: target.url,
  });

  await browser.tabs.update(target.id, { active: true }).catch(() => {});

  const settings = await getSettings();
  const shortcutLabel = formatKeyboardShortcut(settings.transcribeShortcut);

  try {
    await promptTranscriptionCapture(
      target.id,
      `Press ${shortcutLabel} on this page to start transcription, or click Allow tab audio below.`,
    );
    motifLog("transcribe", "Showed needs-capture overlay on fallback tab", {
      tabId: target.id,
    });
  } catch (error: unknown) {
    motifWarn("transcribe", "Could not open transcription overlay on fallback tab", {
      tabId: target.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function handleTranscribeCommand(
  incomingTab: browser.tabs.Tab | undefined,
  source: string,
): void {
  motifLog("transcribe", "handleTranscribeCommand", {
    source,
    tabId: incomingTab?.id,
    url: incomingTab?.url,
    active: incomingTab?.active,
    capturable: isCapturableWebTab(incomingTab),
    transcriptionTabId,
  });

  if (!isCapturableWebTab(incomingTab)) {
    void handleTranscribeCommandWithoutCapturableTab(source);
    return;
  }

  const tabId = incomingTab.id;

  if (shouldDedupeTranscribeInvoke(tabId, source)) {
    return;
  }

  if (transcriptionTabId === tabId) {
    motifLog("transcribe", "Toggle off — stopping transcription", { tabId });
    void stopTranscription();
    return;
  }

  motifLog("transcribe", "Requesting tab capture stream id (sync)", { tabId, source });
  const streamIdPromise =
    source === "manifest-command"
      ? requestTabCaptureStreamId()
      : requestTabCaptureStreamId(tabId);
  void beginTranscriptionCapture(tabId, streamIdPromise, source);
}

function handleSpeakCommand(incomingTab: browser.tabs.Tab | undefined): void {
  motifLog("speak", "handleSpeakCommand", {
    tabId: incomingTab?.id,
    url: incomingTab?.url,
    capturable: isCapturableWebTab(incomingTab),
  });

  void (async () => {
    const tab = isCapturableWebTab(incomingTab)
      ? incomingTab
      : await findTranscriptionTargetTab();

    if (!tab?.id) {
      return;
    }

    await beginSpeakSelection(tab.id);
  })();
}

export default defineBackground(() => {
  motifLog("background", "Service worker started");

  bindManifestCommandSync();
  void syncManifestCommands().then(() => {
    void logRegisteredCommands("Startup");
  });

  void warmUpOffscreenTts().catch((error: unknown) => {
    console.warn("[motif] Background TTS warm-up failed:", error);
  });
  void warmUpOffscreenOcr().catch((error: unknown) => {
    console.warn("[motif] Background OCR warm-up failed:", error);
  });

  browser.runtime.onInstalled.addListener(() => {
    motifLog("background", "onInstalled — syncing manifest commands");
    void syncManifestCommands();
    void warmUpOffscreenTts().catch((error: unknown) => {
      console.warn("[motif] Install TTS warm-up failed:", error);
    });
    void warmUpOffscreenOcr().catch((error: unknown) => {
      console.warn("[motif] Install OCR warm-up failed:", error);
    });
  });

  browser.commands.onCommand.addListener((command, tab) => {
    motifLog("commands", "onCommand fired", {
      command,
      tabId: tab?.id,
      url: tab?.url,
    });

    if (command === SPEAK_COMMAND) {
      handleSpeakCommand(tab);
      return;
    }

    if (command === TRANSCRIBE_COMMAND) {
      handleTranscribeCommand(tab, "manifest-command");
      return;
    }

    motifWarn("commands", "Unhandled command", { command });
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "transcribe-command-gesture") {
      motifLog("transcribe", "transcribe-command-gesture from content script", {
        tabId: sender.tab?.id,
        url: sender.tab?.url,
      });
      handleTranscribeCommand(sender.tab, "content-script");
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "start-transcription-gesture") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({
          ok: false,
          error: "Transcription must be started from a web page tab.",
        });
        return false;
      }

      // getMediaStreamId must be invoked before the first await in this handler.
      const streamIdPromise = requestTabCaptureStreamId(tabId);

      void streamIdPromise
        .then((streamId) => startTranscriptionWithCapture(tabId, streamId))
        .then((result) => sendResponse(result))
        .catch((error: unknown) => {
          const detail =
            error instanceof Error
              ? error.message
              : "Tab audio capture was denied.";
          sendResponse({ ok: false, active: false, error: detail });
        });
      return true;
    }

    if (message?.type === "start-transcription-with-stream") {
      const tabId = message.tabId ?? sender.tab?.id;
      const streamId =
        typeof message.streamId === "string" ? message.streamId : "";

      motifLog("transcribe", "start-transcription-with-stream", {
        tabId,
        streamIdLength: streamId.length,
      });

      if (!tabId || !streamId) {
        sendResponse({
          ok: false,
          error: "Tab audio capture was denied.",
        });
        return false;
      }

      void startTranscriptionWithCapture(tabId, streamId)
        .then((result) => sendResponse(result))
        .catch((error: unknown) => {
          const detail =
            error instanceof Error
              ? error.message
              : "Could not start transcription.";
          sendResponse({ ok: false, active: false, error: detail });
        });
      return true;
    }

    if (message?.type === "get-transcription-state") {
      void (async () => {
        const offscreenSession = await getOffscreenTranscriptionSession();
        const tabId = transcriptionTabId ?? offscreenSession.tabId;
        const active =
          transcriptionTabId !== null ||
          (offscreenSession.active && offscreenSession.tabId !== null);
        const requestingTabId = sender.tab?.id;

        const meta = await getTranscriptionTabMeta(tabId);
        sendResponse({
          active,
          tabId,
          activeForThisTab:
            active &&
            requestingTabId !== undefined &&
            tabId !== null &&
            tabId === requestingTabId,
          tabTitle: meta.tabTitle,
          tabUrl: meta.tabUrl,
          offscreenDocument: await browser.offscreen.hasDocument(),
        });
      })();
      return true;
    }

    if (message?.type === "speak-selection-gesture") {
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, error: "Speak selection must start from a web page tab." });
        return false;
      }

      void beginSpeakSelection(tabId).then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message?.type === "toggle-transcription") {
      void toggleTranscription().then(sendResponse);
      return true;
    }

    if (message?.type === "vocab-lookup") {
      return lookupVocabEntry(message.original)
        .then((entry) => ({ ok: true as const, entry }))
        .catch((error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Vocabulary lookup failed.",
        }));
    }

    if (message?.type === "vocab-create") {
      return createVocabEntry(message.payload)
        .then((entry) => ({ ok: true as const, entry }))
        .catch((error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Could not save vocabulary.",
        }));
    }

    if (message?.type === "vocab-add-context") {
      return addVocabContext(message.normalized, message.context)
        .then((entry) => ({ ok: true as const, entry }))
        .catch((error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Could not add context.",
        }));
    }

    if (message?.type === "vocab-update-note") {
      return updateVocabNote(message.normalized, message.note)
        .then((entry) => ({ ok: true as const, entry }))
        .catch((error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Could not update note.",
        }));
    }

    if (message?.type === "vocab-delete-context") {
      return deleteVocabContext(message.normalized, message.contextId)
        .then((entry) => ({ ok: true as const, entry }))
        .catch((error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Could not delete context.",
        }));
    }

    if (message?.type === "vocab-export") {
      return exportVocab()
        .then((data) => ({ ok: true as const, data }))
        .catch((error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Vocabulary export failed.",
        }));
    }

    if (message?.type === "vocab-import") {
      return importVocab(message.data)
        .then(({ imported, merged }) => ({
          ok: true as const,
          imported,
          merged,
        }))
        .catch((error: unknown) => ({
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Vocabulary import failed.",
        }));
    }

    return false;
  });

  browser.runtime.onMessage.addListener((message: Message, sender) => {
    if (isVocabMessageType(message.type)) {
      return;
    }

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
        console.warn("[motif] Offscreen playback failed:", error);
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

      void handleSpeakWordMessage(message, tabId);
      return;
    }

    if (message.type === "stop-transcription") {
      void stopTranscription();
      return;
    }

    if (message.type === "dismiss-transcription") {
      void dismissTranscription();
      return;
    }

    if (message.type === "stt-transcript-status-relay") {
      if (transcriptionTabId !== message.tabId) {
        return;
      }

      void browser.tabs
        .sendMessage(message.tabId, {
          type: "transcript-status",
          text: message.text,
          ready: message.ready,
          progress: message.progress,
          percent: message.percent,
        } satisfies Message)
        .catch(() => {
          // Tab may have navigated away.
        });
      return;
    }

    if (message.type === "stt-transcript-relay") {
      if (transcriptionTabId !== message.tabId) {
        return;
      }

      void browser.tabs
        .sendMessage(message.tabId, {
          type: "transcript-chunk",
          text: message.text,
          isFinal: message.isFinal,
        } satisfies Message)
        .catch(() => {
          // Tab may have navigated away.
        });
      return;
    }

    if (message.type === "stt-transcript-error-relay") {
      if (transcriptionTabId !== message.tabId) {
        return;
      }

      transcriptionTabId = null;
      void browser.tabs
        .sendMessage(message.tabId, {
          type: "transcript-error",
          message: message.message,
        } satisfies Message)
        .catch(() => {
          // Tab may have navigated away.
        });
      void stopTabTranscriptionInOffscreen();
      broadcastTranscriptionState(message.message);
      return;
    }

    if (message.type === "capture-region-selected") {
      resolveCaptureWait(message.requestId, message.selection);
      return;
    }

    if (message.type === "session-idle") {
      void handleSessionIdle(sender.tab?.id);
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    if (transcriptionTabId === tabId) {
      transcriptionTabId = null;
      void cancelTabTranscriptionInOffscreen();
      broadcastTranscriptionState();
    }

    invalidateTabRequest(tabId);
    clearTabSession(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== "loading" || transcriptionTabId !== tabId) {
      return;
    }

    transcriptionTabId = null;
    void cancelTabTranscriptionInOffscreen();
    broadcastTranscriptionState();
  });
});
