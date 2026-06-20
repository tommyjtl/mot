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
import { phraseFromWordRange } from "../utils/overlay-phrase";
import {
  currentLatencyCompensationS,
  estimatedPlaybackTimeS,
  highlightPlaybackTimeS,
  resetPlaybackClock,
  stopPlaybackClock,
  syncPlaybackClock,
} from "../utils/overlay-playback-clock";
import { ALIGNMENT_DEBUG_UI_ENABLED } from "../utils/supertonic/constants";
import {
  estimateAlignmentWithDebugTuning,
  resetAlignmentDebugBindings,
  syncAlignmentDebug,
  updateAlignmentDebugDuringPlayback,
  type AlignmentDebugHost,
} from "../utils/overlay-alignment-debug";
import { estimateAlignmentFromAudio } from "../utils/alignment-from-audio";
import { hideSelectionToast, showSelectionLimitToast } from "../utils/toast";
import {
  hideCaptureOverlay,
  showCaptureOverlay,
} from "../utils/capture-region";
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
let pinnedWordStart: number | null = null;
let pinnedWordEnd: number | null = null;
let pinnedPhraseText: string | null = null;
let highlightLoopId = 0;
let highlightLoopActive = false;
let isPlaying = false;
let activeRequestId = 0;
let wordSynthRequestId = 0;
let lastReportedPlaybackTimeS = 0;

function estimateSessionAlignment(
  audioBase64: string,
  displayText: string,
): TtsAlignment | null {
  if (ALIGNMENT_DEBUG_UI_ENABLED) {
    return estimateAlignmentWithDebugTuning(audioBase64, displayText);
  }
  return estimateAlignmentFromAudio(audioBase64, displayText);
}

function alignmentDebugHost(): AlignmentDebugHost {
  return {
    getAlignment: () => playbackAlignment ?? fullAlignment,
    getActiveWordIndex: () => {
      if (!cachedSpeechText) {
        return null;
      }
      return overlayWordIndexAtTime(
        cachedSpeechText,
        estimatedPlaybackTimeS(),
        playbackDuration,
        playbackAlignment,
      );
    },
    getReportedTimeS: () => lastReportedPlaybackTimeS,
    getEstimatedTimeS: () => estimatedPlaybackTimeS(),
    getLatencyCompensationS: () => currentLatencyCompensationS(),
    getDurationS: () => playbackDuration,
    hasClip: () => Boolean(currentPlaybackBase64 ?? fullAudioBase64),
    onRealign: () => applyEstimatedAlignmentToSession(),
  };
}

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
  pinnedWordStart = null;
  pinnedWordEnd = null;
  pinnedPhraseText = null;
  wordSynthRequestId = 0;
  resetAlignmentDebugBindings();
  lastReportedPlaybackTimeS = 0;
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

    syncOverlayHighlight(highlightPlaybackTimeS(), playbackDuration);
    updateAlignmentDebugDuringPlayback(alignmentDebugHost());
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
  pinnedWordStart = null;
  pinnedWordEnd = null;
  pinnedPhraseText = null;
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
  hideCaptureOverlay();
  hideOverlay();
  void unlockSession();
}

function syncOverlayHighlight(currentTime: number, duration: number): void {
  if (!cachedSpeechText) {
    return;
  }

  if (playbackScope === "word" && pinnedWordStart !== null) {
    if (isPlaying) {
      const end = pinnedWordEnd ?? pinnedWordStart;
      const isPhrase = end > pinnedWordStart;

      if (isPhrase && playbackAlignment?.words.length && pinnedPhraseText) {
        const localIndex = overlayWordIndexAtTime(
          pinnedPhraseText,
          currentTime,
          duration,
          playbackAlignment,
        );

        if (localIndex !== null) {
          highlightOverlayWord(pinnedWordStart + localIndex);
        } else {
          highlightOverlayWord(pinnedWordStart, end);
        }
      } else {
        highlightOverlayWord(pinnedWordStart, end);
      }
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

function applyEstimatedAlignmentToSession(): void {
  if (!cachedSpeechText || !fullAudioBase64) {
    return;
  }

  const estimated = estimateSessionAlignment(fullAudioBase64, cachedSpeechText);
  if (!estimated) {
    return;
  }

  fullAlignment = estimated;
  if (playbackScope === "full") {
    playbackAlignment = estimated;
  }
  playbackDuration = alignmentDuration(fullAlignment);
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

  resetPlaybackClock();
  playbackScope = "full";
  playbackAlignment = fullAlignment;
  pinnedWordStart = null;
  pinnedWordEnd = null;
  pinnedPhraseText = null;
  playbackDuration = alignmentDuration(fullAlignment);
  setOverlayStatusMessage("Click or drag across words to hear them.");
  requestPlayback(fullAudioBase64);
}

function togglePlayback(): void {
  if (isPlaying) {
    stopAudio();
    return;
  }

  playFullSelection();
}

function speakWordRange(startIndex: number, endIndex: number): void {
  if (!cachedSpeechText) {
    return;
  }

  const phraseText = phraseFromWordRange(
    cachedSpeechText,
    startIndex,
    endIndex,
  );
  if (!phraseText.trim()) {
    return;
  }

  stopAudio();
  setWordLoadingIndex(startIndex, endIndex);
  setOverlayStatusMessage(`Generating “${phraseText}”…`);
  void refreshWordTranslation(phraseText);

  const requestId = (wordSynthRequestId += 1);

  void browser.runtime.sendMessage({
    type: "speak-word",
    word: phraseText,
    wordIndex: startIndex,
    endWordIndex: endIndex,
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
      onWordSelect: speakWordRange,
    },
    rect,
    closeOverlay,
  );

  void refreshFullTranslation(text);
  syncAlignmentDebug(alignmentDebugHost());
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
  pinnedWordStart = message.wordIndex;
  pinnedWordEnd = message.endWordIndex ?? message.wordIndex;
  pinnedPhraseText = message.payload.ok ? message.payload.word : null;
  currentPlaybackBase64 = message.payload.audioBase64;
  const aligned = estimateSessionAlignment(
    message.payload.audioBase64,
    message.payload.word,
  );
  playbackAlignment = aligned ?? message.payload.alignment ?? null;
  playbackDuration = alignmentDuration(playbackAlignment);
  resetPlaybackClock();
  setOverlayStatusMessage(`Playing “${message.payload.word}”.`);
  syncAlignmentDebug(alignmentDebugHost());
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

  lastReportedPlaybackTimeS = message.currentTime;

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
      setOverlayStatusMessage("Click or drag across words to hear them.");
    }

    return;
  }

  syncPlaybackClock(message.currentTime);
  setPlayingState(true);
  startHighlightLoop();
  syncOverlayHighlight(highlightPlaybackTimeS(), duration);
  updateAlignmentDebugDuringPlayback(alignmentDebugHost());
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
        hideCaptureOverlay();
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

        const evaluated = evaluateSelection();
        const result =
          evaluated.status === "empty"
            ? ({ status: "ocr" } as const)
            : evaluated;

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

      if (message.type === "start-capture-mode") {
        if (!isActiveRequest(message.requestId)) {
          return;
        }

        hideOverlay();
        hideSelectionToast();
        void showCaptureOverlay(message.requestId).then((selection) => {
          void browser.runtime.sendMessage({
            type: "capture-region-selected",
            requestId: message.requestId,
            selection,
          } satisfies Message);
        });
        return;
      }

      if (message.type === "ocr-started") {
        if (!isActiveRequest(message.requestId)) {
          return;
        }

        showOverlay(
          {
            kind: "loading-model",
            text: "Recognizing text…",
            detail: message.detail ?? "Recognizing text…",
          },
          message.rect,
          closeOverlay,
        );
        return;
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
        currentPlaybackBase64 = payload.audioBase64;
        cachedSpeechText = payload.text;
        playbackScope = "full";
        applyEstimatedAlignmentToSession();
        if (!fullAlignment) {
          fullAlignment = payload.alignment ?? null;
        }
        playbackAlignment = fullAlignment;
        playbackDuration = alignmentDuration(fullAlignment);
        pinnedWordStart = null;
        pinnedWordEnd = null;
        pinnedPhraseText = null;
        resetPlaybackClock();

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
          hideCaptureOverlay();
          hideOverlay();
        }
      }
    });
  },
});
