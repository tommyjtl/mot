import { createStore, createStoreHook } from "../../lib/create-store";
import {
  initialTtsOverlayState,
  type TtsOverlayStoreState,
} from "./types";

export const ttsOverlayStore = createStore<TtsOverlayStoreState>(
  initialTtsOverlayState(),
);

export const {
  useStore: useTtsOverlayStore,
  useStoreSelector: useTtsOverlaySelector,
} = createStoreHook(ttsOverlayStore);

export function resetTtsOverlayStore(): void {
  ttsOverlayStore.setState(initialTtsOverlayState());
}
