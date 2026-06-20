import { createStoreHook } from "../../lib/create-store";
import {
  initialTranscriptOverlayState,
  type TranscriptOverlayStoreState,
} from "./types";
import { createStore } from "../../lib/create-store";

export const transcriptOverlayStore = createStore<TranscriptOverlayStoreState>(
  initialTranscriptOverlayState(),
);

export const {
  useStore: useTranscriptOverlayStore,
  useStoreSelector: useTranscriptOverlaySelector,
} = createStoreHook(transcriptOverlayStore);

export function resetTranscriptOverlayStore(): void {
  transcriptOverlayStore.setState(initialTranscriptOverlayState());
}
