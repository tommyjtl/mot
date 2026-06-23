import type { VocabEntry } from "../../utils/vocab/types";
import {
  initialWordOverlayState,
  wordOverlayStore,
} from "./word-overlay-store";

type OpenWordOverlayParams = {
  originalText: string;
  translationText: string;
  passageText: string;
  entry: VocabEntry | null;
};

export function closeWordOverlay(): void {
  wordOverlayStore.setState({
    ...initialWordOverlayState(),
  });
}

export function openWordOverlay(params: OpenWordOverlayParams): void {
  const current = wordOverlayStore.getState();

  if (current.open && current.originalText === params.originalText) {
    closeWordOverlay();
    return;
  }

  if (current.open) {
    wordOverlayStore.setState({
      originalText: params.originalText,
      translationText: params.translationText,
      passageText: params.passageText,
      entry: params.entry,
      actionError: null,
    });
    return;
  }

  wordOverlayStore.setState({
    open: true,
    userMoved: false,
    position: null,
    originalText: params.originalText,
    translationText: params.translationText,
    passageText: params.passageText,
    entry: params.entry,
    addingContext: false,
    deletingContextId: null,
    actionError: null,
    saveBusy: false,
  });
}

export function isWordOverlayOpenFor(originalText: string): boolean {
  const state = wordOverlayStore.getState();
  return state.open && state.originalText === originalText;
}
