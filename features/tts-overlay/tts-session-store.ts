import type { TtsAlignment } from "../../utils/tts-types";
import { createStore } from "../../lib/create-store";

export type PlaybackScope = "full" | "word";

export type TtsSessionState = {
  fullAudioBase64: string | null;
  fullAlignment: TtsAlignment | null;
  currentPlaybackBase64: string | null;
  playbackAlignment: TtsAlignment | null;
  cachedSpeechText: string | null;
  cachedFullTranslation: string | null;
  fullTranslationRequestId: number;
  wordTranslationRequestId: number;
  translationDisplayMode: "full" | "word";
  playbackDuration: number;
  playbackScope: PlaybackScope;
  pinnedWordStart: number | null;
  pinnedWordEnd: number | null;
  pinnedPhraseText: string | null;
  highlightLoopId: number;
  highlightLoopActive: boolean;
  isPlaying: boolean;
  activeRequestId: number;
  wordSynthRequestId: number;
  lastReportedPlaybackTimeS: number;
};

export const initialTtsSessionState = (): TtsSessionState => ({
  fullAudioBase64: null,
  fullAlignment: null,
  currentPlaybackBase64: null,
  playbackAlignment: null,
  cachedSpeechText: null,
  cachedFullTranslation: null,
  fullTranslationRequestId: 0,
  wordTranslationRequestId: 0,
  translationDisplayMode: "full",
  playbackDuration: 0,
  playbackScope: "full",
  pinnedWordStart: null,
  pinnedWordEnd: null,
  pinnedPhraseText: null,
  highlightLoopId: 0,
  highlightLoopActive: false,
  isPlaying: false,
  activeRequestId: 0,
  wordSynthRequestId: 0,
  lastReportedPlaybackTimeS: 0,
});

export const ttsSessionStore = createStore<TtsSessionState>(
  initialTtsSessionState(),
);

export function resetTtsSession(): void {
  ttsSessionStore.setState(initialTtsSessionState());
}

export function patchTtsSession(
  partial: Partial<TtsSessionState> | ((state: TtsSessionState) => Partial<TtsSessionState>),
): void {
  ttsSessionStore.setState(partial);
}

export function getTtsSession(): TtsSessionState {
  return ttsSessionStore.getState();
}

export function nextTtsRequestId(field: "fullTranslationRequestId" | "wordTranslationRequestId" | "wordSynthRequestId"): number {
  const state = getTtsSession();
  const next = state[field] + 1;
  patchTtsSession({ [field]: next });
  return next;
}

export function isActiveTtsRequest(requestId: number): boolean {
  const { activeRequestId } = getTtsSession();
  return requestId > 0 && requestId === activeRequestId;
}
