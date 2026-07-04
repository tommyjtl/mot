import type { SelectionRect } from "./messages";

export type SetupOverlayReason =
  | "mode-required"
  | "cloud-sign-in-required"
  | "cloud-feature-pending";

export function setupOverlayMessage(
  reason: SetupOverlayReason,
  feature?: "tts" | "stt",
): string {
  switch (reason) {
    case "mode-required":
      return "Choose Private or Cloud in Motif Options before using shortcuts.";
    case "cloud-sign-in-required":
      return "Sign in with Google in Motif Options to use cloud mode.";
    case "cloud-feature-pending":
      return feature === "stt"
        ? "Cloud transcription isn't available yet. Check Motif Options for status."
        : feature === "tts"
          ? "Cloud pronunciation isn't available yet. Check Motif Options for status."
          : "This cloud feature isn't available yet. Check Motif Options for status.";
    default:
      return "Open Motif Options to finish setup.";
  }
}

/** Centered anchor rect when there is no text selection. */
export function centerViewportSelectionRect(): SelectionRect {
  const width = Math.min(360, Math.max(280, window.innerWidth - 48));
  const height = 72;
  const left = Math.max(16, (window.innerWidth - width) / 2);
  const top = Math.max(16, window.innerHeight * 0.32);

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}
