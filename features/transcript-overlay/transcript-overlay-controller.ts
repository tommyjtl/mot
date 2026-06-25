import type { TranscriptWordTranslationState } from "../../components/overlay/TranslationPanel";
import { destroyShadowReactMount } from "../../components/overlay/mount-shadow-react";
import {
  getLearningTranslationReadiness,
  isLearningTranslationReady,
  isLearningTranslationSupported,
  prepareLearningTranslation,
} from "../../utils/translation";
import { mountTranscriptOverlay } from "./mount";
import {
  resetTranscriptOverlayStore,
  transcriptOverlayStore,
} from "./transcript-overlay-store";
import type {
  TranscriptOverlayHandlers,
  TranscriptOverlayState,
} from "./types";
import { transcriptHandlersRef } from "./types";
import { isTranscriptOverlayMounted } from "./TranscriptOverlay";

export type { TranscriptWordTranslationState };
export { MAX_VISIBLE_TRANSCRIPT_LINES } from "./types";

function ensureMounted(): void {
  mountTranscriptOverlay();
}

function shouldPrepareTranslation(state: TranscriptOverlayState): boolean {
  return (
    state.kind === "loading" ||
    state.kind === "streaming" ||
    state.kind === "paused"
  );
}

function beginTranslationPrepare(): void {
  if (!isLearningTranslationSupported()) {
    transcriptOverlayStore.setState({ translationReadiness: "unsupported" });
    return;
  }

  if (getLearningTranslationReadiness() === "ready") {
    transcriptOverlayStore.setState({ translationReadiness: "ready" });
    return;
  }

  const current = transcriptOverlayStore.getState().translationReadiness;
  if (current === "loading") {
    return;
  }

  transcriptOverlayStore.setState({ translationReadiness: "loading" });
  void prepareLearningTranslation().then((readiness) => {
    if (!transcriptOverlayStore.getState().visible) {
      return;
    }

    transcriptOverlayStore.setState({ translationReadiness: readiness });
  });
}

function applyViewState(
  state: TranscriptOverlayState,
  handlers: TranscriptOverlayHandlers,
): void {
  const clearsTranslation =
    state.kind === "loading" ||
    state.kind === "needs-capture" ||
    state.kind === "error";

  transcriptHandlersRef.current = handlers;

  transcriptOverlayStore.setState({
    visible: true,
    view: state,
    editMode: false,
    editDraft: null,
    ...(clearsTranslation ? { translation: { visible: false } } : {}),
    wordHighlight: null,
    wordLoading: null,
    phraseRange: null,
    playbackVisible: false,
    statusMessage: null,
    statusError: false,
  });

  if (shouldPrepareTranslation(state)) {
    beginTranslationPrepare();
  }
}

export const transcriptOverlay = {
  show(state: TranscriptOverlayState, handlers: TranscriptOverlayHandlers): void {
    ensureMounted();

    const current = transcriptOverlayStore.getState();
    const pendingEditText =
      current.editMode && current.editDraft !== null
        ? current.editDraft
        : null;

    if (pendingEditText && transcriptHandlersRef.current.onTranscriptEdited) {
      transcriptHandlersRef.current.onTranscriptEdited(pendingEditText);
    }

    applyViewState(state, handlers);
  },

  hide(): void {
    destroyShadowReactMount("mot-transcript-overlay-host");
    resetTranscriptOverlayStore();
  },

  setTranslation(
    state: TranscriptWordTranslationState,
    onRestoreFull?: () => void,
  ): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    transcriptOverlayStore.setState({ translation: state });
    transcriptHandlersRef.current = {
      ...transcriptHandlersRef.current,
      onRestoreFullTranslation: onRestoreFull,
    };
  },

  highlightWord(index: number | null, endIndex?: number | null): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    if (index === null) {
      transcriptOverlayStore.setState({
        wordHighlight: null,
        phraseRange: null,
      });
      return;
    }

    transcriptOverlayStore.setState({
      wordHighlight: { start: index, end: endIndex ?? index },
    });
  },

  setPhraseRange(start: number | null, endIndex?: number | null): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    if (start === null) {
      transcriptOverlayStore.setState({ phraseRange: null });
      return;
    }

    const end = endIndex ?? start;
    if (end <= start) {
      transcriptOverlayStore.setState({ phraseRange: null });
      return;
    }

    transcriptOverlayStore.setState({
      phraseRange: { start, end },
    });
  },

  setWordLoading(index: number | null, endIndex?: number | null): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    transcriptOverlayStore.setState({
      wordLoading:
        index === null ? null : { start: index, end: endIndex ?? index },
    });
  },

  setPlaybackVisible(visible: boolean): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    transcriptOverlayStore.setState({ playbackVisible: visible });
  },

  setShowRealtimeTranslation(enabled: boolean): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    if (enabled && !isLearningTranslationReady()) {
      return;
    }

    transcriptOverlayStore.setState({ showRealtimeTranslation: enabled });
  },

  setReadStatus(message: string | null): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    transcriptOverlayStore.setState({
      statusMessage: message,
      statusError: false,
    });
  },

  refreshPaused(lines: string[], partial: string): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    transcriptOverlayStore.setState({
      view: { kind: "paused", lines, partial },
      statusMessage: null,
      statusError: false,
    });
  },

  updateLoadingProgress(detail: string, _percent?: number): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    transcriptOverlayStore.setState({
      statusMessage: detail,
      statusError: false,
    });
  },

  update(lines: string[], partial: string): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    const current = transcriptOverlayStore.getState();
    if (current.editMode) {
      transcriptOverlayStore.setState({
        view: { kind: "streaming", lines, partial },
        statusMessage: null,
        statusError: false,
      });
      return;
    }

    transcriptOverlayStore.setState({
      view: { kind: "streaming", lines, partial },
      statusMessage: null,
      statusError: false,
    });
  },

  isVisible(): boolean {
    return isTranscriptOverlayMounted();
  },
};

export const showTranscriptOverlay = (
  state: TranscriptOverlayState,
  handlers: TranscriptOverlayHandlers,
) => transcriptOverlay.show(state, handlers);

export const hideTranscriptOverlay = () => transcriptOverlay.hide();
export const setTranscriptWordTranslation = (
  state: TranscriptWordTranslationState,
  onRestoreFull?: () => void,
) => transcriptOverlay.setTranslation(state, onRestoreFull);
export const highlightTranscriptWord = (
  index: number | null,
  endIndex?: number | null,
) => transcriptOverlay.highlightWord(index, endIndex);
export const setTranscriptPhraseRange = (
  start: number | null,
  endIndex?: number | null,
) => transcriptOverlay.setPhraseRange(start, endIndex);
export const setTranscriptWordLoading = (
  index: number | null,
  endIndex?: number | null,
) => transcriptOverlay.setWordLoading(index, endIndex);
export const setTranscriptPlaybackVisible = (visible: boolean) =>
  transcriptOverlay.setPlaybackVisible(visible);
export const setTranscriptShowRealtimeTranslation = (enabled: boolean) =>
  transcriptOverlay.setShowRealtimeTranslation(enabled);
export const setTranscriptReadStatus = (message: string | null) =>
  transcriptOverlay.setReadStatus(message);
export const refreshPausedTranscriptOverlay = (
  lines: string[],
  partial: string,
) => transcriptOverlay.refreshPaused(lines, partial);
export const updateTranscriptLoadingProgress = (
  detail: string,
  percent?: number,
) => transcriptOverlay.updateLoadingProgress(detail, percent);
export const updateTranscriptOverlay = (lines: string[], partial: string) =>
  transcriptOverlay.update(lines, partial);
export const isTranscriptOverlayVisible = () => transcriptOverlay.isVisible();

export type { TranscriptOverlayState };
