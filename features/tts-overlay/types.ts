import type { SelectionRect } from "../../utils/messages";
import type { TranslationState } from "../../components/overlay/TranslationPanel";
import type { WordRange } from "../../components/overlay/InteractiveWordText";
import type { AlignmentDebugHost } from "../../utils/overlay-alignment-debug";

export type PlaybackState = "idle" | "playing";

export type OverlayViewState =
  | { kind: "hidden" }
  | { kind: "loading-model"; text: string; detail?: string; percent?: number }
  | { kind: "generating"; text: string; detail?: string; percent?: number }
  | {
    kind: "ready";
    text: string;
    hint?: string;
    playback: PlaybackState;
    onTogglePlayback: () => void;
    onWordSelect?: (startIndex: number, endIndex: number) => void;
  }
  | { kind: "error"; message: string; text?: string };

export type PanelPosition = {
  left: number;
  top: number;
};

export type TtsOverlayHandlers = {
  onClose?: () => void;
  onTogglePlayback?: () => void;
  onWordSelect?: (startIndex: number, endIndex: number) => void;
  onRestoreFullTranslation?: () => void;
};

export type HandlersRef<T> = { current: T };

export const ttsHandlersRef: HandlersRef<TtsOverlayHandlers> = {
  current: {},
};

export type TtsOverlayStoreState = {
  visible: boolean;
  view: OverlayViewState;
  selectionRect?: SelectionRect;
  userMoved: boolean;
  position: PanelPosition | null;
  statusMessage?: string;
  loadingPhase?: "loading-model" | "generating" | "recognizing";
  loadingDetail?: string;
  loadingPercent?: number;
  translation: TranslationState;
  wordHighlight: WordRange | null;
  wordLoading: WordRange | null;
  /** Multi-word phrase bounds during phrase playback (gray background). */
  phraseRange: WordRange | null;
  alignmentDebugHost: AlignmentDebugHost | null;
  alignmentDebugTick: number;
  handlersRef: HandlersRef<TtsOverlayHandlers>;
};

export const initialTtsOverlayState = (): TtsOverlayStoreState => ({
  visible: false,
  view: { kind: "hidden" },
  userMoved: false,
  position: null,
  translation: { visible: false },
  wordHighlight: null,
  wordLoading: null,
  phraseRange: null,
  alignmentDebugHost: null,
  alignmentDebugTick: 0,
  handlersRef: ttsHandlersRef,
});
