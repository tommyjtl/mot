import type { Message, SelectionRect } from "../utils/messages";
import {
  bindOverlayDismissals,
  highlightOverlayWord,
  hideOverlay,
  setOverlayStatusMessage,
  setOverlayTranslation,
  setWordLoadingIndex,
  showOverlay,
  updateOverlayProgress,
  updatePlaybackState,
  type PlaybackState,
} from "../utils/overlay";
import { overlayWordIndexAtTime } from "../utils/overlay-word-sync";
import {
  estimatedPlaybackTimeS,
  resetPlaybackClock,
  stopPlaybackClock,
  syncPlaybackClock,
} from "../utils/overlay-playback-clock";
import { hideSelectionToast, showSelectionLimitToast } from "../utils/toast";
import type { TtsAlignment } from "../utils/tts-types";
import {
  isLearningTranslationSupported,
  translateForLearning,
} from "../utils/translation";

import { evaluateSelection } from "../utils/selection";

type PlaybackScope = "full" | "word";

let fullAudioBase64: string | null = null;
let fullAlignment: TtsAlignment | null = null;
let currentPlaybackBase64: string | null = null;
let playbackAlignment: TtsAlignment | null = null;
let cachedSpeechText: string | null = null;
let cachedFullTranslation: string | null = null;
let fullTranslationRequestId = 0;
let wordTranslationRequestId = 0;
let translationDisplayMode: "full" | "word" = "full";
let playbackDuration = 0;
let playbackScope: PlaybackScope = "full";
let pinnedWordIndex: number | null = null;
let highlightLoopId = 0;
let highlightLoopActive = false;
let isPlaying = false;
let activeRequestId = 0;
let wordSynthRequestId = 0;

function alignmentDuration(alignment: TtsAlignment | null): number {
  const lastEnd = alignment?.words.at(-1)?.end;
  return lastEnd && lastEnd > 0 ? lastEnd : 0;
}

function invalidateActiveRequest(): void {
  activeRequestId = 0;
  fullAudioBase64 = null;
  fullAlignment = null;
  currentPlaybackBase64 = null;
  playbackAlignment = null;
  cachedSpeechText = null;
  cachedFullTranslation = null;
  fullTranslationRequestId += 1;
  wordTranslationRequestId += 1;
  translationDisplayMode = "full";
  setOverlayTranslation({ visible: false });
  playbackDuration = 0;
  playbackScope = "full";
  pinnedWordIndex = null;
  wordSynthRequestId = 0;
  resetPlaybackClock();
  stopHighlightLoop();
}

function showFullTranslation(): void {
  wordTranslationRequestId += 1;
  translationDisplayMode = "full";

  if (cachedFullTranslation) {
    setOverlayTranslation(
      {
        visible: true,
        originalText: cachedSpeechText ?? "",
        translationText: cachedFullTranslation,
        mode: "full",
      },
      showFullTranslation,
    );
    return;
  }

  if (cachedSpeechText) {
    void refreshFullTranslation(cachedSpeechText);
  }
}

async function refreshFullTranslation(text: string): Promise<void> {
  if (!isLearningTranslationSupported()) {
    setOverlayTranslation({ visible: false });
    return;
  }

  const requestId = (fullTranslationRequestId += 1);
  if (translationDisplayMode === "full") {
    setOverlayTranslation(
      {
        visible: true,
        originalText: text,
        translationText: "",
        mode: "full",
        loading: true,
      },
      showFullTranslation,
    );
  }

  const result = await translateForLearning(text);
  if (requestId !== fullTranslationRequestId) {
    return;
  }

  if (!result.ok) {
    if (result.unavailable) {
      if (translationDisplayMode === "full") {
        setOverlayTranslation({ visible: false });
      }
      return;
    }

    if (translationDisplayMode === "full") {
      setOverlayTranslation(
        {
          visible: true,
          originalText: text,
          translationText: result.error,
          mode: "full",
        },
        showFullTranslation,
      );
    }
    return;
  }

  cachedFullTranslation = result.text;
  if (translationDisplayMode === "full") {
    setOverlayTranslation(
      {
        visible: true,
        originalText: text,
        translationText: result.text,
        mode: "full",
      },
      showFullTranslation,
    );
  }
}

async function refreshWordTranslation(word: string): Promise<void> {
  if (!isLearningTranslationSupported()) {
    return;
  }

  translationDisplayMode = "word";
  const requestId = (wordTranslationRequestId += 1);
  setOverlayTranslation(
    {
      visible: true,
      originalText: word,
      translationText: "",
      mode: "word",
      loading: true,
    },
    showFullTranslation,
  );

  const result = await translateForLearning(word);
  if (requestId !== wordTranslationRequestId) {
    return;
  }

  if (!result.ok) {
    setOverlayTranslation(
      {
        visible: true,
        originalText: word,
        translationText: result.error,
        mode: "word",
      },
      showFullTranslation,
    );
    return;
  }

  setOverlayTranslation(
    {
      visible: true,
      originalText: word,
      translationText: result.text,
      mode: "word",
    },
    showFullTranslation,
  );
}

function isActiveRequest(requestId: number): boolean {
  return requestId > 0 && requestId === activeRequestId;
}

function setPlayingState(playing: boolean): void {
  isPlaying = playing;
  updatePlaybackState(playing ? "playing" : "idle");
}

function requestStopEverywhere(): void {
  void browser.runtime.sendMessage({ type: "stop-audio" } satisfies Message);
}

function stopHighlightLoop(): void {
  highlightLoopActive = false;
  if (highlightLoopId) {
    cancelAnimationFrame(highlightLoopId);
    highlightLoopId = 0;
  }
}

function startHighlightLoop(): void {
  stopHighlightLoop();
  highlightLoopActive = true;

  const frame = (): void => {
    if (!highlightLoopActive || !cachedSpeechText) {
      return;
    }

    syncOverlayHighlight(estimatedPlaybackTimeS(), playbackDuration);
    highlightLoopId = requestAnimationFrame(frame);
  };

  highlightLoopId = requestAnimationFrame(frame);
}

function stopAudio(): void {
  stopHighlightLoop();
  stopPlaybackClock();
  highlightOverlayWord(null);
  setWordLoadingIndex(null);
  currentPlaybackBase64 = null;
  playbackAlignment = fullAlignment;
  playbackScope = "full";
  pinnedWordIndex = null;
  playbackDuration = alignmentDuration(fullAlignment);

  if (isPlaying) {
    setPlayingState(false);
  }

  requestStopEverywhere();
}

async function unlockSession(): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: "session-idle" } satisfies Message);
  } catch {
    // Background may be unavailable during extension reload.
  }
}

function closeOverlay(): void {
  invalidateActiveRequest();
  stopAudio();
  hideSelectionToast();
  hideOverlay();
  void unlockSession();
}

function syncOverlayHighlight(currentTime: number, duration: number): void {
  if (!cachedSpeechText) {
    return;
  }

  if (playbackScope === "word" && pinnedWordIndex !== null) {
    if (isPlaying) {
      highlightOverlayWord(pinnedWordIndex);
    }
    return;
  }

  highlightOverlayWord(
    overlayWordIndexAtTime(
      cachedSpeechText,
      currentTime,
      duration,
      playbackAlignment,
    ),
  );
}

function requestPlayback(audioBase64: string): void {
  currentPlaybackBase64 = audioBase64;

  void browser.runtime.sendMessage({
    type: "play-audio",
    audioBase64,
  } satisfies Message);
}

function playFullSelection(): void {
  if (!fullAudioBase64) {
    return;
  }

  playbackScope = "full";
  playbackAlignment = fullAlignment;
  pinnedWordIndex = null;
  playbackDuration = alignmentDuration(fullAlignment);
  setOverlayStatusMessage("Click a word to hear it on its own.");
  requestPlayback(fullAudioBase64);
}

function togglePlayback(): void {
  if (isPlaying) {
    stopAudio();
    return;
  }

  playFullSelection();
}

function speakWord(wordIndex: number, wordText: string): void {
  stopAudio();
  setWordLoadingIndex(wordIndex);
  setOverlayStatusMessage(`Generating “${wordText}”…`);
  void refreshWordTranslation(wordText);

  const requestId = (wordSynthRequestId += 1);

  void browser.runtime.sendMessage({
    type: "speak-word",
    word: wordText,
    wordIndex,
    requestId,
  } satisfies Message);
}

function showReadyOverlay(
  text: string,
  rect: SelectionRect,
  playback: PlaybackState,
  hint?: string,
): void {
  cachedSpeechText = text;

  showOverlay(
    {
      kind: "ready",
      text,
      hint,
      playback,
      onTogglePlayback: togglePlayback,
      onWordClick: speakWord,
    },
    rect,
    closeOverlay,
  );

  void refreshFullTranslation(text);
}

function handleWordTtsResult(
  message: Extract<Message, { type: "word-tts-result" }>,
): void {
  if (message.requestId !== wordSynthRequestId) {
    return;
  }

  setWordLoadingIndex(null);

  if (!message.payload.ok) {
    setOverlayStatusMessage(message.payload.error);
    return;
  }

  playbackScope = "word";
  pinnedWordIndex = message.wordIndex;
  currentPlaybackBase64 = message.payload.audioBase64;
  playbackAlignment = message.payload.alignment ?? null;
  playbackDuration = alignmentDuration(playbackAlignment);
  setOverlayStatusMessage(`Playing “${message.payload.word}”.`);
}

function handlePlaybackMessage(
  message: Extract<Message, { type: "tts-playback" }>,
): void {
  if (!currentPlaybackBase64 || activeRequestId === 0) {
    return;
  }

  if (message.duration > 0) {
    playbackDuration = message.duration;
  }

  const duration =
    playbackDuration ||
    message.duration ||
    alignmentDuration(playbackAlignment);

  if (message.state === "paused" || message.state === "ended") {
    stopHighlightLoop();
    stopPlaybackClock();
    setPlayingState(false);
    highlightOverlayWord(null);

    if (message.state === "ended" && playbackScope === "word") {
      setOverlayStatusMessage("Click a word to hear it on its own.");
    }

    return;
  }

  syncPlaybackClock(message.currentTime);
  setPlayingState(true);
  startHighlightLoop();
  syncOverlayHighlight(estimatedPlaybackTimeS(), duration);
}

export default defineContentScript({
  matches: ["*://*/*"],
  runAt: "document_idle",

  main() {
    bindOverlayDismissals(closeOverlay);

    browser.runtime.onMessage.addListener((message: Message) => {
      if (message.type === "speak-selection") {
        stopAudio();
        hideSelectionToast();
        hideOverlay();
        activeRequestId = message.requestId;
        fullAudioBase64 = null;
        fullAlignment = null;
        cachedSpeechText = null;
        cachedFullTranslation = null;
        fullTranslationRequestId += 1;
        wordTranslationRequestId += 1;
        translationDisplayMode = "full";
        setOverlayTranslation({ visible: false });
        playbackDuration = 0;
        wordSynthRequestId = 0;
        resetPlaybackClock();

        const result = evaluateSelection();

        if (result.status === "ok") {
          showOverlay(
            {
              kind: "loading-model",
              text: result.payload.text,
              detail: "Loading model…",
            },
            result.payload.rect,
            closeOverlay,
          );
        } else if (result.status === "too_long") {
          showSelectionLimitToast({
            length: result.length,
            maxLength: result.maxLength,
            rect: result.rect,
          });
        }

        return Promise.resolve({
          type: "selection-result",
          requestId: message.requestId,
          result,
        } satisfies Message);
      }

      if (message.type === "tts-progress") {
        if (!isActiveRequest(message.requestId)) {
          return;
        }

        updateOverlayProgress(message.phase, message.detail, message.percent);
        return;
      }

      if (message.type === "tts-result") {
        if (!isActiveRequest(message.requestId)) {
          return;
        }

        hideSelectionToast();

        const { payload } = message;

        if (!payload.ok) {
          showOverlay(
            {
              kind: "error",
              message: payload.error,
              text: payload.text,
            },
            payload.rect,
            closeOverlay,
          );
          return;
        }

        fullAudioBase64 = payload.audioBase64;
        fullAlignment = payload.alignment ?? null;
        currentPlaybackBase64 = payload.audioBase64;
        playbackAlignment = fullAlignment;
        playbackDuration = alignmentDuration(fullAlignment);
        playbackScope = "full";
        pinnedWordIndex = null;

        showReadyOverlay(payload.text, payload.rect, "playing");
      }

      if (message.type === "word-tts-result") {
        handleWordTtsResult(message);
        return;
      }

      if (message.type === "tts-playback") {
        handlePlaybackMessage(message);
        return;
      }

      if (message.type === "request-cancelled") {
        if (message.requestId === activeRequestId) {
          invalidateActiveRequest();
          stopAudio();
          hideSelectionToast();
          hideOverlay();
        }
      }
    });
  },
});
