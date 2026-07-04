import type { Message, SelectionRect } from "../utils/messages";
import {
  centerViewportSelectionRect,
  setupOverlayMessage,
} from "../utils/setup-overlay";
import {
  highlightOverlayWord,
  hideOverlay,
  setOverlayPhraseRange,
  setOverlayStatusMessage,
  setOverlayTranslation,
  setWordLoadingIndex,
  showOverlay,
  updateOverlayProgress,
  updatePlaybackState,
  type PlaybackState,
} from "../features/tts-overlay/tts-overlay-controller";
import {
  getTtsSession,
  isActiveTtsRequest,
  nextTtsRequestId,
  patchTtsSession,
} from "../features/tts-overlay/tts-session-store";
import { mountTtsOverlay } from "../features/tts-overlay/mount";
import { overlayWordIndexAtTime } from "../utils/overlay-word-sync";
import { phraseFromWordRange } from "../utils/overlay-phrase";
import { buildWordTranslationState } from "../utils/vocab/translation-vocab";
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
import { translateForLearning } from "../utils/translation";
import { evaluateSelection } from "../utils/selection";
import { sendSpeakWordMessage } from "../utils/speak-word-client";

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
  const session = getTtsSession();
  return {
    getAlignment: () => session.playbackAlignment ?? session.fullAlignment,
    getActiveWordIndex: () => {
      if (!session.cachedSpeechText) {
        return null;
      }
      return overlayWordIndexAtTime(
        session.cachedSpeechText,
        estimatedPlaybackTimeS(),
        session.playbackDuration,
        session.playbackAlignment,
      );
    },
    getReportedTimeS: () => session.lastReportedPlaybackTimeS,
    getEstimatedTimeS: () => estimatedPlaybackTimeS(),
    getLatencyCompensationS: () => currentLatencyCompensationS(),
    getDurationS: () => session.playbackDuration,
    hasClip: () =>
      Boolean(session.currentPlaybackBase64 ?? session.fullAudioBase64),
    onRealign: () => applyEstimatedAlignmentToSession(),
  };
}

function alignmentDuration(alignment: TtsAlignment | null): number {
  const lastEnd = alignment?.words.at(-1)?.end;
  return lastEnd && lastEnd > 0 ? lastEnd : 0;
}

function invalidateActiveRequest(): void {
  const session = getTtsSession();
  patchTtsSession({
    activeRequestId: 0,
    fullAudioBase64: null,
    fullAlignment: null,
    currentPlaybackBase64: null,
    playbackAlignment: null,
    cachedSpeechText: null,
    cachedFullTranslation: null,
    fullTranslationRequestId: session.fullTranslationRequestId + 1,
    wordTranslationRequestId: session.wordTranslationRequestId + 1,
    translationDisplayMode: "full",
    playbackDuration: 0,
    playbackScope: "full",
    pinnedWordStart: null,
    pinnedWordEnd: null,
    pinnedPhraseText: null,
    wordSynthRequestId: 0,
    lastReportedPlaybackTimeS: 0,
  });
  setOverlayTranslation({ visible: false });
  resetAlignmentDebugBindings();
  resetPlaybackClock();
  stopHighlightLoop();
}

function showFullTranslation(): void {
  const session = getTtsSession();
  patchTtsSession({
    wordTranslationRequestId: session.wordTranslationRequestId + 1,
    translationDisplayMode: "full",
  });

  const next = getTtsSession();
  if (next.cachedFullTranslation) {
    setOverlayTranslation(
      {
        visible: true,
        originalText: next.cachedSpeechText ?? "",
        translationText: next.cachedFullTranslation,
        mode: "full",
      },
      showFullTranslation,
    );
    return;
  }

  if (next.cachedSpeechText) {
    void refreshFullTranslation(next.cachedSpeechText);
  }
}

async function refreshFullTranslation(text: string): Promise<void> {
  const requestId = nextTtsRequestId("fullTranslationRequestId");
  if (getTtsSession().translationDisplayMode === "full") {
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
  if (requestId !== getTtsSession().fullTranslationRequestId) {
    return;
  }

  if (!result.ok) {
    if (result.unavailable) {
      if (getTtsSession().translationDisplayMode === "full") {
        setOverlayTranslation({ visible: false });
      }
      return;
    }

    if (getTtsSession().translationDisplayMode === "full") {
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

  patchTtsSession({ cachedFullTranslation: result.text });
  if (getTtsSession().translationDisplayMode === "full") {
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
  const contextText = getTtsSession().cachedSpeechText ?? "";
  const vocabContext = {
    contextText,
    pageUrl: location.href,
    pageTitle: document.title,
  };

  patchTtsSession({ translationDisplayMode: "word" });
  const requestId = nextTtsRequestId("wordTranslationRequestId");
  setOverlayTranslation(
    buildWordTranslationState({
      originalText: word,
      translationText: "",
      loading: true,
      ...vocabContext,
    }),
    showFullTranslation,
  );

  const result = await translateForLearning(word);
  if (requestId !== getTtsSession().wordTranslationRequestId) {
    return;
  }

  if (!result.ok) {
    setOverlayTranslation(
      buildWordTranslationState({
        originalText: word,
        translationText: result.error,
        ...vocabContext,
      }),
      showFullTranslation,
    );
    return;
  }

  setOverlayTranslation(
    buildWordTranslationState({
      originalText: word,
      translationText: result.text,
      vocabReady: true,
      ...vocabContext,
    }),
    showFullTranslation,
  );
}

function setPlayingState(playing: boolean): void {
  patchTtsSession({ isPlaying: playing });
  updatePlaybackState(playing ? "playing" : "idle");
}

function requestStopEverywhere(): void {
  void browser.runtime.sendMessage({ type: "stop-audio" } satisfies Message);
}

function stopHighlightLoop(): void {
  const session = getTtsSession();
  patchTtsSession({ highlightLoopActive: false });
  if (session.highlightLoopId) {
    cancelAnimationFrame(session.highlightLoopId);
    patchTtsSession({ highlightLoopId: 0 });
  }
}

function startHighlightLoop(): void {
  stopHighlightLoop();
  patchTtsSession({ highlightLoopActive: true });

  const frame = (): void => {
    const session = getTtsSession();
    if (!session.highlightLoopActive || !session.cachedSpeechText) {
      return;
    }

    syncOverlayHighlight(
      highlightPlaybackTimeS(),
      session.playbackDuration,
    );
    updateAlignmentDebugDuringPlayback(alignmentDebugHost());
    const loopId = requestAnimationFrame(frame);
    patchTtsSession({ highlightLoopId: loopId });
  };

  const loopId = requestAnimationFrame(frame);
  patchTtsSession({ highlightLoopId: loopId });
}

function stopAudio(): void {
  const session = getTtsSession();
  stopHighlightLoop();
  stopPlaybackClock();
  highlightOverlayWord(null);
  setWordLoadingIndex(null);
  patchTtsSession({
    currentPlaybackBase64: null,
    playbackAlignment: session.fullAlignment,
    playbackScope: "full",
    pinnedWordStart: null,
    pinnedWordEnd: null,
    pinnedPhraseText: null,
    playbackDuration: alignmentDuration(session.fullAlignment),
  });

  if (session.isPlaying) {
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
  const session = getTtsSession();
  if (!session.cachedSpeechText) {
    return;
  }

  if (session.playbackScope === "word" && session.pinnedWordStart !== null) {
    if (session.isPlaying) {
      const end = session.pinnedWordEnd ?? session.pinnedWordStart;
      const isPhrase = end > session.pinnedWordStart;

      if (isPhrase) {
        setOverlayPhraseRange(session.pinnedWordStart, end);

        let activeIndex = session.pinnedWordStart;
        if (session.playbackAlignment?.words.length && session.pinnedPhraseText) {
          const localIndex = overlayWordIndexAtTime(
            session.pinnedPhraseText,
            currentTime,
            duration,
            session.playbackAlignment,
          );

          if (localIndex !== null) {
            activeIndex = session.pinnedWordStart + localIndex;
          }
        }

        highlightOverlayWord(activeIndex);
      } else {
        setOverlayPhraseRange(null);
        highlightOverlayWord(session.pinnedWordStart, end);
      }
    }
    return;
  }

  setOverlayPhraseRange(null);
  highlightOverlayWord(
    overlayWordIndexAtTime(
      session.cachedSpeechText,
      currentTime,
      duration,
      session.playbackAlignment,
    ),
  );
}

function applyEstimatedAlignmentToSession(): void {
  const session = getTtsSession();
  if (!session.cachedSpeechText || !session.fullAudioBase64) {
    return;
  }

  const estimated = estimateSessionAlignment(
    session.fullAudioBase64,
    session.cachedSpeechText,
  );
  if (!estimated) {
    return;
  }

  patchTtsSession({
    fullAlignment: estimated,
    playbackAlignment:
      session.playbackScope === "full" ? estimated : session.playbackAlignment,
    playbackDuration: alignmentDuration(estimated),
  });
}

function requestPlayback(audioBase64: string): void {
  patchTtsSession({ currentPlaybackBase64: audioBase64 });
  void browser.runtime.sendMessage({
    type: "play-audio",
    audioBase64,
  } satisfies Message);
}

function playFullSelection(): void {
  const session = getTtsSession();
  if (!session.fullAudioBase64) {
    return;
  }

  resetPlaybackClock();
  patchTtsSession({
    playbackScope: "full",
    playbackAlignment: session.fullAlignment,
    pinnedWordStart: null,
    pinnedWordEnd: null,
    pinnedPhraseText: null,
    playbackDuration: alignmentDuration(session.fullAlignment),
  });
  setOverlayStatusMessage("Click or drag across words to hear them.");
  requestPlayback(session.fullAudioBase64);
}

function togglePlayback(): void {
  if (getTtsSession().isPlaying) {
    stopAudio();
    return;
  }

  playFullSelection();
}

function speakWordRange(startIndex: number, endIndex: number): void {
  const session = getTtsSession();
  if (!session.cachedSpeechText) {
    return;
  }

  const phraseText = phraseFromWordRange(
    session.cachedSpeechText,
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

  const requestId = nextTtsRequestId("wordSynthRequestId");
  sendSpeakWordMessage({
    word: phraseText,
    wordIndex: startIndex,
    endWordIndex: endIndex,
    requestId,
  });
}

function showReadyOverlay(
  text: string,
  rect: SelectionRect,
  playback: PlaybackState,
  hint?: string,
): void {
  patchTtsSession({ cachedSpeechText: text });

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
  if (message.requestId !== getTtsSession().wordSynthRequestId) {
    return;
  }

  setWordLoadingIndex(null);

  if (!message.payload.ok) {
    setOverlayStatusMessage(message.payload.error);
    return;
  }

  const aligned = estimateSessionAlignment(
    message.payload.audioBase64,
    message.payload.word,
  );

  patchTtsSession({
    playbackScope: "word",
    pinnedWordStart: message.wordIndex,
    pinnedWordEnd: message.endWordIndex ?? message.wordIndex,
    pinnedPhraseText: message.payload.ok ? message.payload.word : null,
    currentPlaybackBase64: message.payload.audioBase64,
    playbackAlignment: aligned ?? message.payload.alignment ?? null,
    playbackDuration: alignmentDuration(
      aligned ?? message.payload.alignment ?? null,
    ),
  });

  const start = message.wordIndex;
  const end = message.endWordIndex ?? message.wordIndex;
  if (end > start) {
    setOverlayPhraseRange(start, end);
  } else {
    setOverlayPhraseRange(null);
  }

  resetPlaybackClock();
  setOverlayStatusMessage(`Playing “${message.payload.word}”.`);
  syncAlignmentDebug(alignmentDebugHost());
}

function handlePlaybackMessage(
  message: Extract<Message, { type: "tts-playback" }>,
): void {
  const session = getTtsSession();
  if (!session.currentPlaybackBase64 || session.activeRequestId === 0) {
    return;
  }

  if (message.duration > 0) {
    patchTtsSession({ playbackDuration: message.duration });
  }

  patchTtsSession({ lastReportedPlaybackTimeS: message.currentTime });

  const duration =
    getTtsSession().playbackDuration ||
    message.duration ||
    alignmentDuration(getTtsSession().playbackAlignment);

  if (message.state === "paused" || message.state === "ended") {
    stopHighlightLoop();
    stopPlaybackClock();
    setPlayingState(false);
    highlightOverlayWord(null);

    if (message.state === "ended" && session.playbackScope === "word") {
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
    mountTtsOverlay();

    browser.runtime.onMessage.addListener((message: Message) => {
      if (message.type === "show-tts-setup-overlay") {
        showOverlay(
          {
            kind: "error",
            message: setupOverlayMessage(message.reason, message.feature),
            text: "Motif",
          },
          centerViewportSelectionRect(),
          closeOverlay,
        );
        return;
      }

      if (message.type === "speak-selection") {
        stopAudio();
        hideSelectionToast();
        hideCaptureOverlay();
        hideOverlay();
        patchTtsSession({
          activeRequestId: message.requestId,
          fullAudioBase64: null,
          fullAlignment: null,
          cachedSpeechText: null,
          cachedFullTranslation: null,
          fullTranslationRequestId:
            getTtsSession().fullTranslationRequestId + 1,
          wordTranslationRequestId:
            getTtsSession().wordTranslationRequestId + 1,
          translationDisplayMode: "full",
          playbackDuration: 0,
          wordSynthRequestId: 0,
        });
        setOverlayTranslation({ visible: false });
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
        if (!isActiveTtsRequest(message.requestId)) {
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
        if (!isActiveTtsRequest(message.requestId)) {
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
        if (!isActiveTtsRequest(message.requestId)) {
          return;
        }

        updateOverlayProgress(message.phase, message.detail, message.percent);
        return;
      }

      if (message.type === "tts-result") {
        if (!isActiveTtsRequest(message.requestId)) {
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

        patchTtsSession({
          fullAudioBase64: payload.audioBase64,
          currentPlaybackBase64: payload.audioBase64,
          cachedSpeechText: payload.text,
          playbackScope: "full",
          pinnedWordStart: null,
          pinnedWordEnd: null,
          pinnedPhraseText: null,
        });
        applyEstimatedAlignmentToSession();

        const session = getTtsSession();
        if (!session.fullAlignment) {
          patchTtsSession({ fullAlignment: payload.alignment ?? null });
        }
        patchTtsSession({
          playbackAlignment: getTtsSession().fullAlignment,
          playbackDuration: alignmentDuration(getTtsSession().fullAlignment),
        });
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
        if (message.requestId === getTtsSession().activeRequestId) {
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
