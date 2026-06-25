import type { TranslationState } from "../../components/overlay/TranslationPanel";
import type { WordRange } from "../../components/overlay/InteractiveWordText";
import type { LearningTranslationReadiness } from "../../utils/translation";
import { isLearningTranslationSupported } from "../../utils/translation";

export const MAX_VISIBLE_TRANSCRIPT_LINES = 3;
export const WAITING_PLACEHOLDER = "Waiting for transcription";

export type TranscriptOverlayViewState =
  | { kind: "hidden" }
  | { kind: "loading"; detail: string; percent?: number }
  | { kind: "streaming"; lines: string[]; partial: string }
  | { kind: "paused"; lines: string[]; partial?: string }
  | { kind: "needs-capture"; tabId: number; message?: string }
  | { kind: "error"; message: string };

export type TranscriptOverlayHandlers = {
  onStop?: () => void;
  onResume?: () => void;
  onClose?: () => void;
  onAllowCapture?: () => void;
  onReset?: () => void;
  onTranscriptEdited?: (text: string) => void;
  onWordSelect?: (startIndex: number, endIndex: number) => void;
  onStopPlayback?: () => void;
  onRestoreFullTranslation?: () => void;
  onToggleRealtimeTranslation?: (enabled: boolean) => void;
};

export type HandlersRef<T> = { current: T };

export const transcriptHandlersRef: HandlersRef<TranscriptOverlayHandlers> = {
  current: {},
};

export type TranscriptOverlayStoreState = {
  visible: boolean;
  view: TranscriptOverlayViewState;
  editMode: boolean;
  editDraft: string | null;
  translation: TranslationState;
  wordHighlight: WordRange | null;
  wordLoading: WordRange | null;
  /** Multi-word phrase bounds during phrase playback (gray background). */
  phraseRange: WordRange | null;
  playbackVisible: boolean;
  showRealtimeTranslation: boolean;
  translationReadiness: LearningTranslationReadiness;
  statusMessage: string | null;
  statusError: boolean;
  handlersRef: HandlersRef<TranscriptOverlayHandlers>;
};

export const initialTranscriptOverlayState = (): TranscriptOverlayStoreState => ({
  visible: false,
  view: { kind: "hidden" },
  editMode: false,
  editDraft: null,
  translation: { visible: false },
  wordHighlight: null,
  wordLoading: null,
  phraseRange: null,
  playbackVisible: false,
  showRealtimeTranslation: false,
  translationReadiness: isLearningTranslationSupported() ? "idle" : "unsupported",
  statusMessage: null,
  statusError: false,
  handlersRef: transcriptHandlersRef,
});

export type TranscriptOverlayState = Exclude<
  TranscriptOverlayViewState,
  { kind: "hidden" }
>;
