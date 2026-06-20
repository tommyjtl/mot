import type { TranscriptWordTranslationState } from "../../components/overlay/TranslationPanel";
import { destroyShadowReactMount } from "../../components/overlay/mount-shadow-react";
import { mountTranscriptOverlay } from "./mount";
import {
  resetTranscriptOverlayStore,
  transcriptOverlayStore,
} from "./transcript-overlay-store";
import type {
  TranscriptOverlayHandlers,
  TranscriptOverlayState,
} from "./types";
import { isTranscriptOverlayMounted } from "./TranscriptOverlay";

export type { TranscriptWordTranslationState };
export { MAX_VISIBLE_TRANSCRIPT_LINES } from "./types";

function ensureMounted(): void {
  mountTranscriptOverlay();
}

function applyViewState(
  state: TranscriptOverlayState,
  handlers: TranscriptOverlayHandlers,
): void {
  let statusMessage: string | null = null;
  let statusError = false;

  if (state.kind === "loading") {
    statusMessage = state.detail;
  } else if (state.kind === "needs-capture") {
    statusMessage =
      state.message ??
      "Tab audio capture needs your confirmation on this page.";
  } else if (state.kind === "error") {
    statusMessage = state.message;
    statusError = true;
  }

  const clearsTranslation =
    state.kind === "loading" ||
    state.kind === "needs-capture" ||
    state.kind === "error";

  transcriptOverlayStore.setState({
    visible: true,
    view: state,
    editMode: false,
    editDraft: null,
    ...(clearsTranslation ? { translation: { visible: false } } : {}),
    wordHighlight: null,
    wordLoading: null,
    playbackVisible: false,
    statusMessage,
    statusError,
    handlers,
  });
}

export const transcriptOverlay = {
  show(state: TranscriptOverlayState, handlers: TranscriptOverlayHandlers): void {
    ensureMounted();

    const current = transcriptOverlayStore.getState();
    const pendingEditText =
      current.editMode && current.editDraft !== null
        ? current.editDraft
        : null;

    if (pendingEditText && current.handlers.onTranscriptEdited) {
      current.handlers.onTranscriptEdited(pendingEditText);
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

    const current = transcriptOverlayStore.getState();
    transcriptOverlayStore.setState({
      translation: state,
      handlers: {
        ...current.handlers,
        onRestoreFullTranslation: onRestoreFull,
      },
    });
  },

  highlightWord(index: number | null, endIndex?: number | null): void {
    if (!isTranscriptOverlayMounted()) {
      return;
    }

    transcriptOverlayStore.setState({
      wordHighlight:
        index === null
          ? null
          : { start: index, end: endIndex ?? index },
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

  bindDismissals(onClose: () => void): void {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || !isTranscriptOverlayMounted()) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown, true);
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
export const bindTranscriptDismissals = (onClose: () => void) =>
  transcriptOverlay.bindDismissals(onClose);

export type { TranscriptOverlayState };
