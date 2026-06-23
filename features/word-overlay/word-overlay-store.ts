import { createStore, createStoreHook } from "../../lib/create-store";
import type { PanelPosition } from "../../utils/overlay-layout";
import type { VocabEntry } from "../../utils/vocab/types";

export const WORD_OVERLAY_WIDTH = 320;

export type WordOverlayState = {
  open: boolean;
  userMoved: boolean;
  position: PanelPosition | null;
  originalText: string;
  translationText: string;
  passageText: string;
  entry: VocabEntry | null;
  addingContext: boolean;
  deletingContextId: string | null;
  actionError: string | null;
  saveBusy: boolean;
};

export const initialWordOverlayState = (): WordOverlayState => ({
  open: false,
  userMoved: false,
  position: null,
  originalText: "",
  translationText: "",
  passageText: "",
  entry: null,
  addingContext: false,
  deletingContextId: null,
  actionError: null,
  saveBusy: false,
});

export const wordOverlayStore = createStore<WordOverlayState>(
  initialWordOverlayState(),
);

export function resetWordOverlayStore(): void {
  wordOverlayStore.setState(initialWordOverlayState());
}

export const { useStoreSelector: useWordOverlaySelector } =
  createStoreHook(wordOverlayStore);
