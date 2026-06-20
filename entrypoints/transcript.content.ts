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
  bindTranscriptDismissals,
  hideTranscriptOverlay,
  highlightTranscriptWord,
  isTranscriptOverlayVisible,
  MAX_VISIBLE_TRANSCRIPT_LINES,
  refreshPausedTranscriptOverlay,
  setTranscriptPlaybackVisible,
  setTranscriptReadStatus,
  setTranscriptWordLoading,
  setTranscriptWordTranslation,
  showTranscriptOverlay,
  updateTranscriptLoadingProgress,
  updateTranscriptOverlay,
} from "../utils/live-transcript-overlay";
import {
  isLearningTranslationSupported,
  translateForLearning,
} from "../utils/translation";

let transcribing = false;
let overlayDismissed = false;
let captureInitiatedLocally = false;
let preserveLinesOnNextStart = false;
let finalizedLines: string[] = [];
let partialLine = "";

let cachedVisibleSpeechText: string | null = null;
let wordSynthRequestId = 0;
let wordTranslationRequestId = 0;
let currentPlaybackBase64: string | null = null;
let playbackAlignment: TtsAlignment | null = null;
let playbackDuration = 0;
let pinnedWordStart: number | null = null;
let pinnedWordEnd: number | null = null;
let pinnedPhraseText: string | null = null;
let highlightLoopId = 0;
let highlightLoopActive = false;

type StartCaptureResponse = {
  ok?: boolean;
  active?: boolean;
  error?: string;
};

function getVisibleTranscriptText(): string {
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
  transcribing = false;
  finalizedLines = [];
  partialLine = "";
  captureInitiatedLocally = false;
  preserveLinesOnNextStart = false;
  wordTranslationRequestId += 1;
  cachedVisibleSpeechText = null;
}

function finalizePartialLine(): void {
  if (partialLine.trim()) {
    finalizedLines.push(partialLine.trim());
    partialLine = "";
  }
}

function requestStopTranscription(): Promise<void> {
  return browser.runtime.sendMessage({
    type: "stop-transcription",
  } satisfies Message) as Promise<void>;
}

function requestStopAudio(): void {
  void browser.runtime.sendMessage({ type: "stop-audio" } satisfies Message);
}

function stopHighlightLoop(): void {
  highlightLoopActive = false;
  if (highlightLoopId) {
    cancelAnimationFrame(highlightLoopId);
    highlightLoopId = 0;
  }
}

function stopTranscriptAudio(): void {
  wordSynthRequestId += 1;
  stopHighlightLoop();
  stopPlaybackClock();
  if (isTranscriptOverlayVisible()) {
    highlightTranscriptWord(null);
    setTranscriptWordLoading(null);
    setTranscriptPlaybackVisible(false);
    setTranscriptReadStatus(null);
  }
  currentPlaybackBase64 = null;
  playbackAlignment = null;
  playbackDuration = 0;
  pinnedWordStart = null;
  pinnedWordEnd = null;
  pinnedPhraseText = null;
  requestStopAudio();
}

function clearReadModeUi(): void {
  wordTranslationRequestId += 1;
  if (isTranscriptOverlayVisible()) {
    setTranscriptWordTranslation({ visible: false });
  }
}

function startHighlightLoop(): void {
  stopHighlightLoop();
  highlightLoopActive = true;

  const frame = (): void => {
    if (!highlightLoopActive || !cachedVisibleSpeechText) {
      return;
    }

    syncTranscriptHighlight(highlightPlaybackTimeS(), playbackDuration);
    highlightLoopId = requestAnimationFrame(frame);
  };

  highlightLoopId = requestAnimationFrame(frame);
}

function syncTranscriptHighlight(currentTime: number, duration: number): void {
  if (!cachedVisibleSpeechText || pinnedWordStart === null) {
    return;
  }

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
      highlightTranscriptWord(pinnedWordStart + localIndex);
    } else {
      highlightTranscriptWord(pinnedWordStart, end);
    }
    return;
  }

  highlightTranscriptWord(pinnedWordStart, end);
}

function requestPlayback(audioBase64: string): void {
  currentPlaybackBase64 = audioBase64;

  void browser.runtime.sendMessage({
    type: "play-audio",
    audioBase64,
  } satisfies Message);
}

async function refreshWordTranslation(word: string): Promise<void> {
  if (!isLearningTranslationSupported()) {
    return;
  }

  const requestId = (wordTranslationRequestId += 1);
  setTranscriptWordTranslation({
    visible: true,
    originalText: word,
    translationText: "",
    loading: true,
  });

  const result = await translateForLearning(word);
  if (requestId !== wordTranslationRequestId) {
    return;
  }

  if (!result.ok) {
    if (result.unavailable) {
      setTranscriptWordTranslation({ visible: false });
      return;
    }

    setTranscriptWordTranslation({
      visible: true,
      originalText: word,
      translationText: result.error,
      loading: false,
    });
    return;
  }

  setTranscriptWordTranslation({
    visible: true,
    originalText: word,
    translationText: result.text,
    loading: false,
  });
}

function speakWordRange(startIndex: number, endIndex: number): void {
  const text = getVisibleTranscriptText();
  if (!text) {
    return;
  }

  cachedVisibleSpeechText = text;
  const phraseText = phraseFromWordRange(text, startIndex, endIndex);
  if (!phraseText.trim()) {
    return;
  }

  stopTranscriptAudio();
  setTranscriptWordLoading(startIndex, endIndex);
  setTranscriptReadStatus(`Generating “${phraseText}”…`);
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

function handleWordTtsResult(
  message: Extract<Message, { type: "word-tts-result" }>,
): void {
  if (!isTranscriptOverlayVisible()) {
    return;
  }

  if (message.requestId !== wordSynthRequestId) {
    return;
  }

  setTranscriptWordLoading(null);

  if (!message.payload.ok) {
    setTranscriptReadStatus(message.payload.error);
    return;
  }

  pinnedWordStart = message.wordIndex;
  pinnedWordEnd = message.endWordIndex ?? message.wordIndex;
  pinnedPhraseText = message.payload.word;
  const aligned = estimateAlignmentFromAudio(
    message.payload.audioBase64,
    message.payload.word,
  );
  playbackAlignment = aligned ?? message.payload.alignment ?? null;
  playbackDuration = alignmentDuration(playbackAlignment);
  resetPlaybackClock();
  setTranscriptReadStatus(`Playing “${message.payload.word}”.`);
  setTranscriptPlaybackVisible(true);
  requestPlayback(message.payload.audioBase64);
}

function handlePlaybackMessage(
  message: Extract<Message, { type: "tts-playback" }>,
): void {
  if (!isTranscriptOverlayVisible() || !currentPlaybackBase64) {
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
    highlightTranscriptWord(null);
    setTranscriptPlaybackVisible(false);
    setTranscriptReadStatus(null);
    currentPlaybackBase64 = null;
    return;
  }

  syncPlaybackClock(message.currentTime);
  setTranscriptPlaybackVisible(true);
  startHighlightLoop();
  syncTranscriptHighlight(highlightPlaybackTimeS(), duration);
}

async function closeOverlay(): Promise<void> {
  overlayDismissed = true;
  stopTranscriptAudio();
  clearReadModeUi();

  if (transcribing) {
    try {
      await requestStopTranscription();
    } catch {
      // Background may be unavailable during reload.
    }
  }

  hideTranscriptOverlay();
  resetTranscriptState();
}

function showStartCaptureError(message: string): void {
  transcribing = false;
  captureInitiatedLocally = false;
  preserveLinesOnNextStart =
    finalizedLines.length > 0 || partialLine.trim().length > 0;
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

  if (overlayDismissed) {
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
  overlayDismissed = false;
  captureInitiatedLocally = true;
  preserveLinesOnNextStart = options.preserveLines;
  transcribing = true;
  stopTranscriptAudio();
  clearReadModeUi();

  if (options.preserveLines) {
    showTranscriptOverlay(
      {
        kind: "streaming",
        lines: finalizedLines,
        partial: partialLine,
      },
      overlayHandlers(),
    );
    updateTranscriptLoadingProgress(options.detail);
  } else {
    finalizedLines = [];
    partialLine = "";
    preserveLinesOnNextStart = false;
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
      if (overlayDismissed) {
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
  clearReadModeUi();
  finalizedLines = [];
  partialLine = "";
  cachedVisibleSpeechText = null;
  if (transcribing) {
    updateTranscriptOverlay([], "");
  } else {
    refreshPausedTranscriptOverlay([], "");
  }
}

function applyEditedTranscript(text: string): void {
  const entries = [...finalizedLines];
  if (partialLine) {
    entries.push(partialLine);
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

  if (transcribing && merged.length > 0) {
    partialLine = merged[merged.length - 1];
    finalizedLines = merged.slice(0, -1);
  } else {
    finalizedLines = merged.filter((line) => line.length > 0);
    partialLine = "";
  }

  cachedVisibleSpeechText = getVisibleTranscriptText();

  if (transcribing) {
    updateTranscriptOverlay(finalizedLines, partialLine);
  } else {
    refreshPausedTranscriptOverlay(finalizedLines, partialLine);
  }
}

function overlayHandlers() {
  return {
    onStop: () => {
      stopTranscriptAudio();
      clearReadModeUi();
      if (transcribing) {
        void requestStopTranscription();
      }
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
  };
}

function appendTranscript(text: string, isFinal: boolean): void {
  if (!text && isFinal) {
    finalizePartialLine();
    return;
  }

  if (text) {
    partialLine += text;
  }

  if (isFinal && partialLine.trim()) {
    finalizedLines.push(partialLine.trim());
    partialLine = "";
  }

  cachedVisibleSpeechText = getVisibleTranscriptText();
  updateTranscriptOverlay(finalizedLines, partialLine);
}

export default defineContentScript({
  matches: ["*://*/*"],
  runAt: "document_idle",

  main() {
    bindTranscriptDismissals(closeOverlay);

    void browser.runtime
      .sendMessage({ type: "get-transcription-state" })
      .then((state: { activeForThisTab?: boolean } | undefined) => {
        if (state?.activeForThisTab) {
          // Offscreen capture can outlive the old document after navigation.
          void requestStopTranscription();
        }
      });

    browser.runtime.onMessage.addListener((message: Message) => {
      if (overlayDismissed) {
        if (
          message.type === "transcript-stopped" ||
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
        overlayDismissed = false;
        transcribing = true;
        stopTranscriptAudio();
        clearReadModeUi();

        if (captureInitiatedLocally) {
          captureInitiatedLocally = false;
          preserveLinesOnNextStart = false;
          updateTranscriptLoadingProgress("Connecting to tab audio…");
          return;
        }

        if (preserveLinesOnNextStart) {
          preserveLinesOnNextStart = false;
          showTranscriptOverlay(
            {
              kind: "streaming",
              lines: finalizedLines,
              partial: partialLine,
            },
            overlayHandlers(),
          );
          updateTranscriptLoadingProgress("Connecting to tab audio…");
          return;
        }

        finalizedLines = [];
        partialLine = "";
        showTranscriptOverlay(
          { kind: "loading", detail: "Connecting to tab audio…" },
          overlayHandlers(),
        );
        return;
      }

      if (message.type === "transcript-request-capture") {
        overlayDismissed = false;
        transcribing = false;
        captureInitiatedLocally = false;
        preserveLinesOnNextStart = false;
        finalizedLines = [];
        partialLine = "";
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
        if (!transcribing) {
          transcribing = true;
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
          showTranscriptOverlay(
            {
              kind: "streaming",
              lines: finalizedLines,
              partial: partialLine,
            },
            overlayHandlers(),
          );
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
        if (!transcribing) {
          transcribing = true;
        }

        appendTranscript(message.text, message.isFinal);
        return;
      }

      if (message.type === "transcript-stopped") {
        if (overlayDismissed) {
          return;
        }

        finalizePartialLine();
        transcribing = false;
        captureInitiatedLocally = false;
        preserveLinesOnNextStart =
          finalizedLines.length > 0 || partialLine.trim().length > 0;
        stopTranscriptAudio();
        clearReadModeUi();
        cachedVisibleSpeechText = getVisibleTranscriptText();

        if (finalizedLines.length === 0 && partialLine.trim().length === 0) {
          hideTranscriptOverlay();
          resetTranscriptState();
          return;
        }

        showTranscriptOverlay(
          { kind: "paused", lines: finalizedLines },
          overlayHandlers(),
        );
        return;
      }

      if (message.type === "transcript-error") {
        if (overlayDismissed) {
          return;
        }

        transcribing = false;
        captureInitiatedLocally = false;
        preserveLinesOnNextStart =
          finalizedLines.length > 0 || partialLine.trim().length > 0;
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
