import type { TranslationViewState } from "../../components/overlay/TranslationPanel";
import {
  destroyShadowReactMount,
} from "../../components/overlay/mount-shadow-react";
import { isCaptureOverlayVisible } from "../../utils/capture-region";
import type { SelectionRect } from "../../utils/messages";
import type { AlignmentDebugHost } from "../../utils/overlay-alignment-debug";
import { resetAlignmentDebugBindings } from "../../utils/overlay-alignment-debug";
import { resetAlignmentDebugPanelState } from "./alignment-debug-state";
import { mountTtsOverlay } from "./mount";
import {
  resetTtsOverlayStore,
  ttsOverlayStore,
} from "./tts-overlay-store";
import type { OverlayViewState, PlaybackState, TtsOverlayStoreState } from "./types";
import { isTtsOverlayVisible } from "./TtsOverlay";

export type {
  PlaybackState,
  OverlayViewState as OverlayState,
  TranslationViewState,
};

function ensureMounted(): void {
  mountTtsOverlay();
}

export const ttsOverlay = {
  show(
    view: Exclude<OverlayViewState, { kind: "hidden" }>,
    rect?: SelectionRect,
    onClose?: () => void,
  ): void {
    ensureMounted();

    const handlers: TtsOverlayStoreState["handlers"] = {
      ...ttsOverlayStore.getState().handlers,
      onClose,
    };

    if (view.kind === "ready") {
      handlers.onTogglePlayback = view.onTogglePlayback;
      handlers.onWordSelect = view.onWordSelect;
    }

    ttsOverlayStore.setState({
      visible: true,
      view,
      selectionRect: rect,
      userMoved: ttsOverlayStore.getState().userMoved,
      translation: { visible: false },
      wordHighlight: null,
      wordLoading: null,
      statusMessage: undefined,
      loadingPhase: undefined,
      loadingDetail: undefined,
      loadingPercent: undefined,
      handlers,
    });
  },

  hide(): void {
    resetAlignmentDebugBindings();
    resetAlignmentDebugPanelState();
    destroyShadowReactMount("mot-tts-overlay-host");
    resetTtsOverlayStore();
  },

  setTranslation(
    state: TranslationViewState,
    onRestoreFull?: () => void,
  ): void {
    if (!isTtsOverlayVisible()) {
      return;
    }

    const current = ttsOverlayStore.getState();
    if (!state.visible || current.view.kind !== "ready") {
      ttsOverlayStore.setState({
        translation: { visible: false },
        handlers: {
          ...current.handlers,
          onRestoreFullTranslation: undefined,
        },
      });
      return;
    }

    ttsOverlayStore.setState({
      translation: state,
      handlers: {
        ...current.handlers,
        onRestoreFullTranslation: onRestoreFull,
      },
    });
  },

  highlightWord(index: number | null, endIndex?: number | null): void {
    if (!isTtsOverlayVisible()) {
      return;
    }

    ttsOverlayStore.setState({
      wordHighlight:
        index === null
          ? null
          : { start: index, end: endIndex ?? index },
    });
  },

  setWordLoading(index: number | null, endIndex?: number | null): void {
    if (!isTtsOverlayVisible()) {
      return;
    }

    ttsOverlayStore.setState({
      wordLoading:
        index === null ? null : { start: index, end: endIndex ?? index },
    });
  },

  setStatusMessage(message: string): void {
    if (!isTtsOverlayVisible()) {
      return;
    }

    ttsOverlayStore.setState({ statusMessage: message });
  },

  updateProgress(
    phase: "loading-model" | "generating" | "recognizing",
    detail?: string,
    percent?: number,
  ): void {
    if (!isTtsOverlayVisible()) {
      return;
    }

    ttsOverlayStore.setState({
      translation: { visible: false },
      loadingPhase: phase,
      loadingDetail: detail,
      loadingPercent: percent,
    });
  },

  updatePlaybackState(playback: PlaybackState): void {
    const current = ttsOverlayStore.getState();
    if (!isTtsOverlayVisible() || current.view.kind !== "ready") {
      return;
    }

    ttsOverlayStore.setState({
      view: { ...current.view, playback },
    });
  },

  setAlignmentDebugHost(host: AlignmentDebugHost | null): void {
    ttsOverlayStore.setState({ alignmentDebugHost: host });
  },

  syncAlignmentDebug(): void {
    ttsOverlayStore.setState({
      alignmentDebugTick: ttsOverlayStore.getState().alignmentDebugTick + 1,
    });
  },

  updateAlignmentDebugDuringPlayback(): void {
    ttsOverlayStore.setState({
      alignmentDebugTick: ttsOverlayStore.getState().alignmentDebugTick + 1,
    });
  },

  bindDismissals(onDismiss?: () => void): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss?.();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        !isTtsOverlayVisible() ||
        isCaptureOverlayVisible()
      ) {
        return;
      }

      const host = document.getElementById("mot-tts-overlay-host");
      if (!host || !event.composedPath().includes(host)) {
        onDismiss?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  },
};

// Back-compat named exports for content script migration
export const showOverlay = (
  state: Exclude<OverlayViewState, { kind: "hidden" }> & {
    onTogglePlayback?: () => void;
    onWordSelect?: (startIndex: number, endIndex: number) => void;
  },
  rect?: SelectionRect,
  onClose?: () => void,
) => {
  if (state.kind === "ready") {
    ttsOverlay.show(state, rect, onClose);
    return;
  }

  ttsOverlay.show(state, rect, onClose);
};

export const hideOverlay = () => ttsOverlay.hide();
export const setOverlayTranslation = (
  state: TranslationViewState,
  onRestoreFull?: () => void,
) => ttsOverlay.setTranslation(state, onRestoreFull);
export const highlightOverlayWord = (
  index: number | null,
  endIndex?: number | null,
) => ttsOverlay.highlightWord(index, endIndex);
export const setWordLoadingIndex = (
  index: number | null,
  endIndex?: number | null,
) => ttsOverlay.setWordLoading(index, endIndex);
export const setOverlayStatusMessage = (message: string) =>
  ttsOverlay.setStatusMessage(message);
export const updateOverlayProgress = (
  phase: "loading-model" | "generating" | "recognizing",
  detail?: string,
  percent?: number,
) => ttsOverlay.updateProgress(phase, detail, percent);
export const updatePlaybackState = (playback: PlaybackState) =>
  ttsOverlay.updatePlaybackState(playback);
export const bindOverlayDismissals = (onDismiss?: () => void) =>
  ttsOverlay.bindDismissals(onDismiss);
