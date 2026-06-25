import type { OverlayViewState } from "../features/tts-overlay/types";
import type { TranscriptOverlayViewState } from "../features/transcript-overlay/types";

export type OverlayStatus = {
  message: string | null;
  error: boolean;
};

export function deriveStatusFromTranscriptView(
  view: TranscriptOverlayViewState,
): OverlayStatus {
  if (view.kind === "loading") {
    return { message: view.detail, error: false };
  }

  if (view.kind === "needs-capture") {
    return {
      message:
        view.message ??
        "Tab audio capture needs your confirmation on this page.",
      error: false,
    };
  }

  if (view.kind === "error") {
    return { message: view.message, error: true };
  }

  return { message: null, error: false };
}

export function deriveStatusFromTtsView(view: OverlayViewState): OverlayStatus {
  if (view.kind === "error") {
    return { message: view.message, error: true };
  }

  return { message: null, error: false };
}
