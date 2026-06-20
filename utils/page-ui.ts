import { hideOverlay } from "../features/tts-overlay/tts-overlay-controller";
import { hideSelectionToast } from "./toast";

/** Dismiss toast and pronunciation overlay without touching the session lock. */
export function clearPageUi(): void {
  hideSelectionToast();
  hideOverlay();
}
