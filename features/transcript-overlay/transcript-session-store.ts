import type { TtsAlignment } from "../../utils/tts-types";
import { createStore } from "../../lib/create-store";

export type TranscriptSessionState = {
  transcribing: boolean;
  overlayDismissed: boolean;
  stopExpectedFromUi: boolean;
  captureInitiatedLocally: boolean;
  preserveLinesOnNextStart: boolean;
  finalizedLines: string[];
  partialLine: string;
  cachedVisibleSpeechText: string | null;
  cachedFullTranslation: string | null;
  cachedFullTranslationText: string | null;
  wordSynthRequestId: number;
  wordTranslationRequestId: number;
  fullTranslationRequestId: number;
  translationDisplayMode: "full" | "word";
  showRealtimeTranslation: boolean;
  fullTranslationDebounceId: ReturnType<typeof setTimeout> | null;
  currentPlaybackBase64: string | null;
  playbackAlignment: TtsAlignment | null;
  playbackDuration: number;
  pinnedWordStart: number | null;
  pinnedWordEnd: number | null;
  pinnedPhraseText: string | null;
  highlightLoopId: number;
  highlightLoopActive: boolean;
};

export const FULL_TRANSLATION_DEBOUNCE_MS = 600;

export const initialTranscriptSessionState = (): TranscriptSessionState => ({
  transcribing: false,
  overlayDismissed: false,
  stopExpectedFromUi: false,
  captureInitiatedLocally: false,
  preserveLinesOnNextStart: false,
  finalizedLines: [],
  partialLine: "",
  cachedVisibleSpeechText: null,
  cachedFullTranslation: null,
  cachedFullTranslationText: null,
  wordSynthRequestId: 0,
  wordTranslationRequestId: 0,
  fullTranslationRequestId: 0,
  translationDisplayMode: "full",
  showRealtimeTranslation: false,
  fullTranslationDebounceId: null,
  currentPlaybackBase64: null,
  playbackAlignment: null,
  playbackDuration: 0,
  pinnedWordStart: null,
  pinnedWordEnd: null,
  pinnedPhraseText: null,
  highlightLoopId: 0,
  highlightLoopActive: false,
});

export const transcriptSessionStore = createStore<TranscriptSessionState>(
  initialTranscriptSessionState(),
);

export function resetTranscriptSession(): void {
  const state = getTranscriptSession();
  if (state.fullTranslationDebounceId !== null) {
    clearTimeout(state.fullTranslationDebounceId);
  }
  transcriptSessionStore.setState(initialTranscriptSessionState());
}

export function patchTranscriptSession(
  partial:
    | Partial<TranscriptSessionState>
    | ((state: TranscriptSessionState) => Partial<TranscriptSessionState>),
): void {
  transcriptSessionStore.setState(partial);
}

export function getTranscriptSession(): TranscriptSessionState {
  return transcriptSessionStore.getState();
}

export function nextTranscriptRequestId(
  field: "fullTranslationRequestId" | "wordTranslationRequestId" | "wordSynthRequestId",
): number {
  const state = getTranscriptSession();
  const next = state[field] + 1;
  patchTranscriptSession({ [field]: next });
  return next;
}
