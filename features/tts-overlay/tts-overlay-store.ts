import { useSyncExternalStore } from "react";
import { createStore } from "../../lib/create-store";
import {
  initialTtsOverlayState,
  type TtsOverlayStoreState,
} from "./types";

export const ttsOverlayStore = createStore<TtsOverlayStoreState>(
  initialTtsOverlayState(),
);

export function useTtsOverlayStore(): TtsOverlayStoreState {
  return useSyncExternalStore(
    ttsOverlayStore.subscribe,
    ttsOverlayStore.getState,
    ttsOverlayStore.getState,
  );
}

export function resetTtsOverlayStore(): void {
  ttsOverlayStore.setState(initialTtsOverlayState());
}
