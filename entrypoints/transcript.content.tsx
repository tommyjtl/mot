import type { Message } from "../utils/messages";
import type { TtsAlignment } from "../utils/tts-types";
import { estimateAlignmentFromAudio } from "../utils/alignment-from-audio";
import { phraseFromWordRange } from "../utils/overlay-phrase";
import { overlayWordIndexAtTime } from "../utils/overlay-word-sync";
import {
  highlightPlaybackTimeS,
  resetPlaybackClock,
  stopPlaybackClock,
  syncPlaybackClock,
} from "../utils/overlay-playback-clock";
import {
  hideTranscriptOverlay,
  highlightTranscriptWord,
  isTranscriptOverlayVisible,
  MAX_VISIBLE_TRANSCRIPT_LINES,
  refreshPausedTranscriptOverlay,
  setTranscriptPhraseRange,
  setTranscriptPlaybackVisible,
  setTranscriptReadStatus,
  setTranscriptShowRealtimeTranslation,
  setTranscriptWordLoading,
  setTranscriptWordTranslation,
  showTranscriptOverlay,
  updateTranscriptLoadingProgress,
  updateTranscriptOverlay,
} from "../features/transcript-overlay/transcript-overlay-controller";
import { mountTranscriptOverlay } from "../features/transcript-overlay/mount";
import {
  isLearningTranslationSupported,
  translateForLearning,
} from "../utils/translation";
import {
  FULL_TRANSLATION_DEBOUNCE_MS,
  getTranscriptSession,
  nextTranscriptRequestId,
  patchTranscriptSession,
  resetTranscriptSession,
} from "../features/transcript-overlay/transcript-session-store";

type StartCaptureResponse = {
  ok?: boolean;
  active?: boolean;
  error?: string;
};

function getVisibleTranscriptText(): string {
  const { finalizedLines, partialLine } = getTranscriptSession();
  const entries = [...finalizedLines];
  if (partialLine) {
    entries.push(partialLine);
  }

  if (entries.length === 0) {
    return "";
  }

  return entries.slice(-MAX_VISIBLE_TRANSCRIPT_LINES).join("\n");
}

function alignmentDuration(alignment: TtsAlignment | null): number {
  const lastEnd = alignment?.words.at(-1)?.end;
  return lastEnd && lastEnd > 0 ? lastEnd : 0;
}

function resetTranscriptState(): void {
  const session = getTranscriptSession();
  if (session.fullTranslationDebounceId !== null) {
    clearTimeout(session.fullTranslationDebounceId);
  }
  resetTranscriptSession();
}

function finalizePartialLine(): void {
  const session = getTranscriptSession();
  if (session.partialLine.trim()) {
    patchTranscriptSession({
      finalizedLines: [...session.finalizedLines, session.partialLine.trim()],
      partialLine: "",
    });
  }
}

function requestStopTranscription(): Promise<void> {
  return browser.runtime.sendMessage({
    type: "stop-transcription",
  } satisfies Message) as Promise<void>;
}

function requestDismissTranscription(): Promise<void> {
  return browser.runtime.sendMessage({
    type: "dismiss-transcription",
  } satisfies Message) as Promise<void>;
}

function requestStopAudio(): void {
  void browser.runtime.sendMessage({ type: "stop-audio" } satisfies Message);
}

function stopHighlightLoop(): void {
  const session = getTranscriptSession();
  patchTranscriptSession({ highlightLoopActive: false });
  if (session.highlightLoopId) {
    cancelAnimationFrame(session.highlightLoopId);
    patchTranscriptSession({ highlightLoopId: 0 });
  }
}

function stopTranscriptAudio(): void {
  nextTranscriptRequestId("wordSynthRequestId");
  stopHighlightLoop();
  stopPlaybackClock();
  if (isTranscriptOverlayVisible()) {
    highlightTranscriptWord(null);
    setTranscriptWordLoading(null);
    setTranscriptPlaybackVisible(false);
    setTranscriptReadStatus(null);
  }
  patchTranscriptSession({
    currentPlaybackBase64: null,
    playbackAlignment: null,
    playbackDuration: 0,
    pinnedWordStart: null,
    pinnedWordEnd: null,
    pinnedPhraseText: null,
  });
  requestStopAudio();
}

function clearTranslationUi(): void {
  const session = getTranscriptSession();
  if (session.fullTranslationDebounceId !== null) {
    clearTimeout(session.fullTranslationDebounceId);
  }
  patchTranscriptSession({
    wordTranslationRequestId: session.wordTranslationRequestId + 1,
    fullTranslationRequestId: session.fullTranslationRequestId + 1,
    fullTranslationDebounceId: null,
  });

  if (isTranscriptOverlayVisible()) {
    setTranscriptWordTranslation({ visible: false });
  }
}

function clearReadModeUi(): void {
  const session = getTranscriptSession();
  patchTranscriptSession({
    wordTranslationRequestId: session.wordTranslationRequestId + 1,
    translationDisplayMode: "full",
  });

  if (getTranscriptSession().showRealtimeTranslation) {
    showFullTranslation();
    return;
  }

  if (isTranscriptOverlayVisible()) {
    setTranscriptWordTranslation({ visible: false });
  }
}

function setShowRealtimeTranslationEnabled(enabled: boolean): void {
  patchTranscriptSession({ showRealtimeTranslation: enabled });
  setTranscriptShowRealtimeTranslation(enabled);

  if (enabled) {
    patchTranscriptSession({ translationDisplayMode: "full" });
    showFullTranslation();
    return;
  }

  const session = getTranscriptSession();
  if (session.fullTranslationDebounceId !== null) {
    clearTimeout(session.fullTranslationDebounceId);
  }
  patchTranscriptSession({
    fullTranslationRequestId: session.fullTranslationRequestId + 1,
    fullTranslationDebounceId: null,
  });

  if (
    getTranscriptSession().translationDisplayMode === "full" &&
    isTranscriptOverlayVisible()
  ) {
    setTranscriptWordTranslation({ visible: false });
  }
}

function showFullTranslation(): void {
  const session = getTranscriptSession();
  patchTranscriptSession({
    wordTranslationRequestId: session.wordTranslationRequestId + 1,
    translationDisplayMode: "full",
  });

  if (!getTranscriptSession().showRealtimeTranslation) {
    if (isTranscriptOverlayVisible()) {
      setTranscriptWordTranslation({ visible: false });
    }
    return;
  }

  const text = getVisibleTranscriptText();
  if (!text.trim()) {
    setTranscriptWordTranslation({ visible: false });
    return;
  }

  const next = getTranscriptSession();
  if (
    next.cachedFullTranslation &&
    next.cachedFullTranslationText === text
  ) {
    setTranscriptWordTranslation(
      {
        visible: true,
        originalText: text,
        translationText: next.cachedFullTranslation,
        mode: "full",
      },
      showFullTranslation,
    );
    return;
  }

  void refreshFullTranslation(text);
}

async function refreshFullTranslation(text: string): Promise<void> {
  if (!getTranscriptSession().showRealtimeTranslation || !isLearningTranslationSupported()) {
    if (isTranscriptOverlayVisible()) {
      setTranscriptWordTranslation({ visible: false });
    }
    return;
  }

  const requestId = nextTranscriptRequestId("fullTranslationRequestId");
  if (getTranscriptSession().translationDisplayMode === "full") {
    setTranscriptWordTranslation(
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
  if (requestId !== getTranscriptSession().fullTranslationRequestId) {
    return;
  }

  if (!result.ok) {
    if (result.unavailable) {
      if (getTranscriptSession().translationDisplayMode === "full") {
        setTranscriptWordTranslation({ visible: false });
      }
      return;
    }

    if (getTranscriptSession().translationDisplayMode === "full") {
      setTranscriptWordTranslation(
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

  patchTranscriptSession({
    cachedFullTranslation: result.text,
    cachedFullTranslationText: text,
  });
  if (getTranscriptSession().translationDisplayMode === "full") {
    setTranscriptWordTranslation(
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

function scheduleFullTranslationRefresh(immediate = false): void {
  if (!getTranscriptSession().showRealtimeTranslation) {
    return;
  }

  const text = getVisibleTranscriptText();
  if (!text.trim()) {
    const session = getTranscriptSession();
    patchTranscriptSession({
      fullTranslationRequestId: session.fullTranslationRequestId + 1,
    });
    setTranscriptWordTranslation({ visible: false });
    return;
  }

  if (getTranscriptSession().translationDisplayMode !== "full") {
    return;
  }

  const session = getTranscriptSession();
  if (session.cachedFullTranslationText !== text) {
    setTranscriptWordTranslation(
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

  if (session.fullTranslationDebounceId !== null) {
    clearTimeout(session.fullTranslationDebounceId);
    patchTranscriptSession({ fullTranslationDebounceId: null });
  }

  if (immediate) {
    const current = getTranscriptSession();
    if (
      current.cachedFullTranslation &&
      current.cachedFullTranslationText === text
    ) {
      setTranscriptWordTranslation(
        {
          visible: true,
          originalText: text,
          translationText: current.cachedFullTranslation,
          mode: "full",
        },
        showFullTranslation,
      );
      return;
    }

    void refreshFullTranslation(text);
    return;
  }

  const debounceId = setTimeout(() => {
    patchTranscriptSession({ fullTranslationDebounceId: null });
    const currentText = getVisibleTranscriptText();
    if (!currentText.trim()) {
      setTranscriptWordTranslation({ visible: false });
      return;
    }

    if (getTranscriptSession().translationDisplayMode !== "full") {
      return;
    }

    const current = getTranscriptSession();
    if (
      current.cachedFullTranslation &&
      current.cachedFullTranslationText === currentText
    ) {
      setTranscriptWordTranslation(
        {
          visible: true,
          originalText: currentText,
          translationText: current.cachedFullTranslation,
          mode: "full",
        },
        showFullTranslation,
      );
      return;
    }

    void refreshFullTranslation(currentText);
  }, FULL_TRANSLATION_DEBOUNCE_MS);
  patchTranscriptSession({ fullTranslationDebounceId: debounceId });
}

function startHighlightLoop(): void {
  stopHighlightLoop();
  patchTranscriptSession({ highlightLoopActive: true });

  const frame = (): void => {
    const session = getTranscriptSession();
    if (!session.highlightLoopActive || !session.cachedVisibleSpeechText) {
      return;
    }

    syncTranscriptHighlight(
      highlightPlaybackTimeS(),
      session.playbackDuration,
    );
    const loopId = requestAnimationFrame(frame);
    patchTranscriptSession({ highlightLoopId: loopId });
  };

  const loopId = requestAnimationFrame(frame);
  patchTranscriptSession({ highlightLoopId: loopId });
}

function syncTranscriptHighlight(currentTime: number, duration: number): void {
  const session = getTranscriptSession();
  if (!session.cachedVisibleSpeechText || session.pinnedWordStart === null) {
    return;
  }

  const end = session.pinnedWordEnd ?? session.pinnedWordStart;
  const isPhrase = end > session.pinnedWordStart;

  if (isPhrase) {
    setTranscriptPhraseRange(session.pinnedWordStart, end);

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

    highlightTranscriptWord(activeIndex);
    return;
  }

  setTranscriptPhraseRange(null);
  highlightTranscriptWord(session.pinnedWordStart, end);
}

function requestPlayback(audioBase64: string): void {
  patchTranscriptSession({ currentPlaybackBase64: audioBase64 });
  void browser.runtime.sendMessage({
    type: "play-audio",
    audioBase64,
  } satisfies Message);
}

async function refreshWordTranslation(word: string): Promise<void> {
  if (!isLearningTranslationSupported()) {
    return;
  }

  patchTranscriptSession({ translationDisplayMode: "word" });
  const requestId = nextTranscriptRequestId("wordTranslationRequestId");
  setTranscriptWordTranslation(
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
  if (requestId !== getTranscriptSession().wordTranslationRequestId) {
    return;
  }

  if (!result.ok) {
    if (result.unavailable) {
      showFullTranslation();
      return;
    }

    setTranscriptWordTranslation(
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

  setTranscriptWordTranslation(
    {
      visible: true,
      originalText: word,
      translationText: result.text,
      mode: "word",
    },
    showFullTranslation,
  );
}

function speakWordRange(startIndex: number, endIndex: number): void {
  const text = getVisibleTranscriptText();
  if (!text) {
    return;
  }

  patchTranscriptSession({ cachedVisibleSpeechText: text });
  const phraseText = phraseFromWordRange(text, startIndex, endIndex);
  if (!phraseText.trim()) {
    return;
  }

  stopTranscriptAudio();
  setTranscriptWordLoading(startIndex, endIndex);
  setTranscriptReadStatus(`Generating “${phraseText}”…`);
  void refreshWordTranslation(phraseText);

  const requestId = nextTranscriptRequestId("wordSynthRequestId");
  void browser.runtime.sendMessage({
    type: "speak-word",
    word: phraseText,
    wordIndex: startIndex,
    endWordIndex: endIndex,
    requestId,
  } satisfies Message);
}

function handleWordTtsResult(
  message: Extract<Message, { type: "word-tts-result" }>,
): void {
  if (!isTranscriptOverlayVisible()) {
    return;
  }

  if (message.requestId !== getTranscriptSession().wordSynthRequestId) {
    return;
  }

  setTranscriptWordLoading(null);

  if (!message.payload.ok) {
    setTranscriptReadStatus(message.payload.error);
    return;
  }

  const aligned = estimateAlignmentFromAudio(
    message.payload.audioBase64,
    message.payload.word,
  );
  const playbackAlignment = aligned ?? message.payload.alignment ?? null;

  patchTranscriptSession({
    pinnedWordStart: message.wordIndex,
    pinnedWordEnd: message.endWordIndex ?? message.wordIndex,
    pinnedPhraseText: message.payload.word,
    playbackAlignment,
    playbackDuration: alignmentDuration(playbackAlignment),
  });

  const start = message.wordIndex;
  const end = message.endWordIndex ?? message.wordIndex;
  if (end > start) {
    setTranscriptPhraseRange(start, end);
  } else {
    setTranscriptPhraseRange(null);
  }

  resetPlaybackClock();
  setTranscriptReadStatus(`Playing “${message.payload.word}”.`);
  setTranscriptPlaybackVisible(true);
  requestPlayback(message.payload.audioBase64);
}

function handlePlaybackMessage(
  message: Extract<Message, { type: "tts-playback" }>,
): void {
  const session = getTranscriptSession();
  if (!isTranscriptOverlayVisible() || !session.currentPlaybackBase64) {
    return;
  }

  if (message.duration > 0) {
    patchTranscriptSession({ playbackDuration: message.duration });
  }

  const duration =
    getTranscriptSession().playbackDuration ||
    message.duration ||
    alignmentDuration(getTranscriptSession().playbackAlignment);

  if (message.state === "paused" || message.state === "ended") {
    stopHighlightLoop();
    stopPlaybackClock();
    highlightTranscriptWord(null);
    setTranscriptPlaybackVisible(false);
    setTranscriptReadStatus(null);
    patchTranscriptSession({ currentPlaybackBase64: null });
    return;
  }

  syncPlaybackClock(message.currentTime);
  setTranscriptPlaybackVisible(true);
  startHighlightLoop();
  syncTranscriptHighlight(highlightPlaybackTimeS(), duration);
}

async function closeOverlay(): Promise<void> {
  patchTranscriptSession({ overlayDismissed: true });
  stopTranscriptAudio();
  clearReadModeUi();
  hideTranscriptOverlay();

  try {
    await requestDismissTranscription();
  } catch {
    // Background may be unavailable during reload.
  }

  resetTranscriptState();
}

function showStartCaptureError(message: string): void {
  const session = getTranscriptSession();
  patchTranscriptSession({
    transcribing: false,
    captureInitiatedLocally: false,
    preserveLinesOnNextStart:
      session.finalizedLines.length > 0 || session.partialLine.trim().length > 0,
  });
  stopTranscriptAudio();
  clearReadModeUi();
  showTranscriptOverlay(
    { kind: "error", message },
    overlayHandlers(),
  );
}

function handleStartCaptureResponse(
  response: StartCaptureResponse | undefined,
): void {
  if (response?.ok) {
    return;
  }

  if (getTranscriptSession().overlayDismissed) {
    return;
  }

  showStartCaptureError(
    response?.error ??
    "Tab audio capture was denied. Focus this tab and try Option+T.",
  );
}

function startCaptureAndTranscribe(options: {
  detail: string;
  preserveLines: boolean;
}): void {
  const session = getTranscriptSession();
  patchTranscriptSession({
    overlayDismissed: false,
    captureInitiatedLocally: true,
    preserveLinesOnNextStart: options.preserveLines,
    transcribing: true,
  });
  stopTranscriptAudio();
  clearReadModeUi();

  if (options.preserveLines) {
    const current = getTranscriptSession();
    showTranscriptOverlay(
      {
        kind: "streaming",
        lines: current.finalizedLines,
        partial: current.partialLine,
      },
      overlayHandlers(),
    );
    updateTranscriptLoadingProgress(options.detail);
    scheduleFullTranslationRefresh();
  } else {
    patchTranscriptSession({
      finalizedLines: [],
      partialLine: "",
      preserveLinesOnNextStart: false,
    });
    showTranscriptOverlay(
      { kind: "loading", detail: options.detail },
      overlayHandlers(),
    );
  }

  void browser.runtime
    .sendMessage({
      type: "start-transcription-gesture",
    } satisfies Message)
    .then((response) => handleStartCaptureResponse(response))
    .catch((error: unknown) => {
      if (getTranscriptSession().overlayDismissed) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Could not reach the extension background worker.";
      showStartCaptureError(message);
    });
}

function beginTranscriptionFromGesture(
  detail = "Requesting tab audio access…",
): void {
  startCaptureAndTranscribe({ detail, preserveLines: false });
}

function resumeTranscriptionFromGesture(
  detail = "Resuming transcription…",
): void {
  startCaptureAndTranscribe({ detail, preserveLines: true });
}

function resetTranscriptContent(): void {
  stopTranscriptAudio();
  patchTranscriptSession({ translationDisplayMode: "full" });
  clearTranslationUi();
  patchTranscriptSession({
    finalizedLines: [],
    partialLine: "",
    cachedVisibleSpeechText: null,
    cachedFullTranslation: null,
    cachedFullTranslationText: null,
  });
  const { transcribing, finalizedLines, partialLine } = getTranscriptSession();
  if (transcribing) {
    updateTranscriptOverlay(finalizedLines, partialLine);
  } else {
    refreshPausedTranscriptOverlay(finalizedLines, partialLine);
  }
}

function applyEditedTranscript(text: string): void {
  const session = getTranscriptSession();
  const entries = [...session.finalizedLines];
  if (session.partialLine) {
    entries.push(session.partialLine);
  }

  const hiddenCount = Math.max(
    0,
    entries.length - MAX_VISIBLE_TRANSCRIPT_LINES,
  );
  const hidden = entries.slice(0, hiddenCount);

  const visibleEdited = text.split("\n");
  while (
    visibleEdited.length > 1 &&
    visibleEdited[visibleEdited.length - 1] === ""
  ) {
    visibleEdited.pop();
  }

  const merged = [...hidden, ...visibleEdited];

  if (session.transcribing && merged.length > 0) {
    patchTranscriptSession({
      partialLine: merged[merged.length - 1] ?? "",
      finalizedLines: merged.slice(0, -1),
    });
  } else {
    patchTranscriptSession({
      finalizedLines: merged.filter((line) => line.length > 0),
      partialLine: "",
    });
  }

  patchTranscriptSession({
    cachedVisibleSpeechText: getVisibleTranscriptText(),
  });

  const next = getTranscriptSession();
  if (next.transcribing) {
    updateTranscriptOverlay(next.finalizedLines, next.partialLine);
  } else {
    refreshPausedTranscriptOverlay(next.finalizedLines, next.partialLine);
  }

  scheduleFullTranslationRefresh(!next.transcribing);
}

function overlayHandlers() {
  return {
    onStop: () => {
      patchTranscriptSession({ stopExpectedFromUi: true });
      stopTranscriptAudio();
      clearReadModeUi();
      void requestStopTranscription();
    },
    onResume: () => {
      stopTranscriptAudio();
      clearReadModeUi();
      resumeTranscriptionFromGesture();
    },
    onClose: closeOverlay,
    onAllowCapture: () => beginTranscriptionFromGesture(),
    onReset: resetTranscriptContent,
    onTranscriptEdited: applyEditedTranscript,
    onWordSelect: speakWordRange,
    onStopPlayback: () => {
      stopTranscriptAudio();
    },
    onToggleRealtimeTranslation: setShowRealtimeTranslationEnabled,
  };
}

function appendTranscript(text: string, isFinal: boolean): void {
  if (!text && isFinal) {
    finalizePartialLine();
    return;
  }

  const session = getTranscriptSession();
  let partialLine = session.partialLine;
  let finalizedLines = session.finalizedLines;

  if (text) {
    partialLine += text;
  }

  if (isFinal && partialLine.trim()) {
    finalizedLines = [...finalizedLines, partialLine.trim()];
    partialLine = "";
  }

  patchTranscriptSession({
    partialLine,
    finalizedLines,
    cachedVisibleSpeechText: (() => {
      const entries = [...finalizedLines];
      if (partialLine) {
        entries.push(partialLine);
      }
      if (entries.length === 0) {
        return "";
      }
      return entries.slice(-MAX_VISIBLE_TRANSCRIPT_LINES).join("\n");
    })(),
  });

  const next = getTranscriptSession();
  updateTranscriptOverlay(next.finalizedLines, next.partialLine);
  scheduleFullTranslationRefresh();
}

export default defineContentScript({
  matches: ["*://*/*"],
  runAt: "document_idle",

  main() {
    mountTranscriptOverlay();

    void browser.runtime
      .sendMessage({ type: "get-transcription-state" })
      .then((state: { activeForThisTab?: boolean } | undefined) => {
        if (state?.activeForThisTab) {
          // Offscreen capture can outlive the old document after navigation.
          void requestStopTranscription();
        }
      });

    browser.runtime.onMessage.addListener((message: Message) => {
      if (getTranscriptSession().overlayDismissed) {
        if (
          message.type === "transcript-error" ||
          message.type === "transcript-status" ||
          message.type === "transcript-chunk"
        ) {
          return;
        }
      }

      if (message.type === "word-tts-result") {
        handleWordTtsResult(message);
        return;
      }

      if (message.type === "tts-playback") {
        handlePlaybackMessage(message);
        return;
      }

      if (message.type === "transcript-started") {
        patchTranscriptSession({
          overlayDismissed: false,
          transcribing: true,
        });
        stopTranscriptAudio();
        clearReadModeUi();

        const session = getTranscriptSession();
        if (session.captureInitiatedLocally) {
          patchTranscriptSession({
            captureInitiatedLocally: false,
            preserveLinesOnNextStart: false,
          });
          updateTranscriptLoadingProgress("Connecting to tab audio…");
          return;
        }

        if (session.preserveLinesOnNextStart) {
          patchTranscriptSession({ preserveLinesOnNextStart: false });
          showTranscriptOverlay(
            {
              kind: "streaming",
              lines: session.finalizedLines,
              partial: session.partialLine,
            },
            overlayHandlers(),
          );
          updateTranscriptLoadingProgress("Connecting to tab audio…");
          scheduleFullTranslationRefresh();
          return;
        }

        patchTranscriptSession({ finalizedLines: [], partialLine: "" });
        showTranscriptOverlay(
          { kind: "loading", detail: "Connecting to tab audio…" },
          overlayHandlers(),
        );
        return;
      }

      if (message.type === "transcript-request-capture") {
        patchTranscriptSession({
          overlayDismissed: false,
          transcribing: false,
          captureInitiatedLocally: false,
          preserveLinesOnNextStart: false,
          finalizedLines: [],
          partialLine: "",
        });
        stopTranscriptAudio();
        clearReadModeUi();
        showTranscriptOverlay(
          {
            kind: "needs-capture",
            message:
              message.message ??
              "Click Allow tab audio to capture sound from this page.",
          },
          overlayHandlers(),
        );
        return;
      }

      if (message.type === "transcript-status") {
        if (!getTranscriptSession().transcribing) {
          patchTranscriptSession({ transcribing: true });
        }

        const detail = message.text.trim().toLowerCase();
        if (
          detail.startsWith("processing") ||
          detail.startsWith("updating transcript")
        ) {
          return;
        }

        if (message.ready || detail.startsWith("listening")) {
          stopTranscriptAudio();
          clearReadModeUi();
          const session = getTranscriptSession();
          showTranscriptOverlay(
            {
              kind: "streaming",
              lines: session.finalizedLines,
              partial: session.partialLine,
            },
            overlayHandlers(),
          );
          scheduleFullTranslationRefresh();
          return;
        }

        const isModelLoad =
          detail.includes("download") ||
          detail.includes("loading speech") ||
          detail.includes("loading speech engine") ||
          detail.includes("webgpu") ||
          detail.includes("tokenizer") ||
          detail.includes("codec") ||
          detail.includes("warming up");

        if (isModelLoad) {
          updateTranscriptLoadingProgress(message.text, message.percent);
          return;
        }

        if (
          detail.startsWith("connecting to tab audio") ||
          detail.includes("capturing tab audio")
        ) {
          updateTranscriptLoadingProgress(message.text);
        }
        return;
      }

      if (message.type === "transcript-chunk") {
        if (!getTranscriptSession().transcribing) {
          patchTranscriptSession({ transcribing: true });
        }

        appendTranscript(message.text, message.isFinal);
        return;
      }

      if (message.type === "transcript-stopped") {
        if (getTranscriptSession().overlayDismissed) {
          return;
        }

        const session = getTranscriptSession();
        if (!session.stopExpectedFromUi && session.transcribing) {
          return;
        }

        finalizePartialLine();
        const afterFinalize = getTranscriptSession();
        patchTranscriptSession({
          stopExpectedFromUi: false,
          transcribing: false,
          captureInitiatedLocally: false,
          preserveLinesOnNextStart:
            afterFinalize.finalizedLines.length > 0 ||
            afterFinalize.partialLine.trim().length > 0,
          cachedVisibleSpeechText: getVisibleTranscriptText(),
        });
        stopTranscriptAudio();
        clearReadModeUi();

        const next = getTranscriptSession();
        showTranscriptOverlay(
          {
            kind: "paused",
            lines: next.finalizedLines,
            partial: next.partialLine,
          },
          overlayHandlers(),
        );
        scheduleFullTranslationRefresh(true);
        return;
      }

      if (message.type === "transcript-error") {
        if (getTranscriptSession().overlayDismissed) {
          return;
        }

        const session = getTranscriptSession();
        patchTranscriptSession({
          transcribing: false,
          captureInitiatedLocally: false,
          preserveLinesOnNextStart:
            session.finalizedLines.length > 0 ||
            session.partialLine.trim().length > 0,
        });
        stopTranscriptAudio();
        clearReadModeUi();
        showTranscriptOverlay(
          { kind: "error", message: message.message },
          overlayHandlers(),
        );
        return;
      }
    });
  },
});
