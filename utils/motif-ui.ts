/** Shadow-DOM host ids for in-page Motif UI (overlays, toast, capture). */
export const MOTIF_UI_HOST_IDS = [
  "mot-tts-overlay-host",
  "mot-word-overlay-host",
  "mot-transcript-overlay-host",
  "mot-capture-overlay-host",
  "mot-selection-toast-host",
] as const;

const motifUiHostIdSet = new Set<string>(MOTIF_UI_HOST_IDS);

/** True when the event target is inside any Motif overlay/toast host. */
export function isPointerOnMotifUi(event: Event): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (motifUiHostIdSet.has(node.id)) {
      return true;
    }
  }

  return false;
}
