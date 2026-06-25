import { useCallback, type RefObject } from "react";
import { isPointerOnMotifUi } from "../utils/motif-ui";
import { useEscapeKey } from "./useEscapeKey";
import { usePointerDownOutside } from "./usePointerDownOutside";

type UseOverlayDismissalsOptions = {
  hostRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  enabled?: boolean;
  /** When false, only Escape dismisses (e.g. live transcript overlay). Default true. */
  dismissOnOutsideClick?: boolean;
  /** Skip outside-click dismiss while capture overlay is visible. */
  ignoreCaptureOverlay?: () => boolean;
  /** Skip outside-click dismiss when clicking another Motif overlay/toast. Default true. */
  ignoreOtherMotifUi?: boolean;
  /** Transcript overlay stops Escape propagation in capture phase. */
  escapeCapture?: boolean;
  escapeStopImmediate?: boolean;
};

export function useOverlayDismissals({
  hostRef,
  onDismiss,
  enabled = true,
  dismissOnOutsideClick = true,
  ignoreCaptureOverlay,
  ignoreOtherMotifUi = true,
  escapeCapture = false,
  escapeStopImmediate = false,
}: UseOverlayDismissalsOptions): void {
  useEscapeKey(onDismiss, enabled, escapeCapture, escapeStopImmediate);

  const shouldIgnore = useCallback(
    (event: PointerEvent) => {
      if (ignoreCaptureOverlay?.()) {
        return true;
      }

      if (ignoreOtherMotifUi && isPointerOnMotifUi(event)) {
        return true;
      }

      return false;
    },
    [ignoreCaptureOverlay, ignoreOtherMotifUi],
  );

  usePointerDownOutside(hostRef, onDismiss, {
    enabled: enabled && dismissOnOutsideClick,
    shouldIgnore,
  });
}
