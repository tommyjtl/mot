import type { SelectionRect } from "../../utils/messages";
import type { TranslationViewState } from "../../components/overlay/TranslationPanel";
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

export type TtsOverlayStoreState = {
  visible: boolean;
  view: OverlayViewState;
  selectionRect?: SelectionRect;
  userMoved: boolean;
  statusMessage?: string;
  loadingPhase?: "loading-model" | "generating" | "recognizing";
  loadingDetail?: string;
  loadingPercent?: number;
  translation: TranslationViewState;
  wordHighlight: WordRange | null;
  wordLoading: WordRange | null;
  alignmentDebugHost: AlignmentDebugHost | null;
  alignmentDebugTick: number;
  handlers: {
    onClose?: () => void;
    onTogglePlayback?: () => void;
    onWordSelect?: (startIndex: number, endIndex: number) => void;
    onRestoreFullTranslation?: () => void;
  };
};

export const initialTtsOverlayState = (): TtsOverlayStoreState => ({
  visible: false,
  view: { kind: "hidden" },
  userMoved: false,
  translation: { visible: false },
  wordHighlight: null,
  wordLoading: null,
  alignmentDebugHost: null,
  alignmentDebugTick: 0,
  handlers: {},
});
