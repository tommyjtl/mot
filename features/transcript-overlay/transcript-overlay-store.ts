import { useSyncExternalStore } from "react";
import { createStore } from "../../lib/create-store";
import {
  initialTranscriptOverlayState,
  type TranscriptOverlayStoreState,
} from "./types";

export const transcriptOverlayStore = createStore<TranscriptOverlayStoreState>(
  initialTranscriptOverlayState(),
);

export function useTranscriptOverlayStore(): TranscriptOverlayStoreState {
  return useSyncExternalStore(
    transcriptOverlayStore.subscribe,
    transcriptOverlayStore.getState,
    transcriptOverlayStore.getState,
  );
}

export function resetTranscriptOverlayStore(): void {
  transcriptOverlayStore.setState(initialTranscriptOverlayState());
}
