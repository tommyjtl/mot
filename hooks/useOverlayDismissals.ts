import { useCallback, type RefObject } from "react";
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
  escapeCapture = false,
  escapeStopImmediate = false,
}: UseOverlayDismissalsOptions): void {
  useEscapeKey(onDismiss, enabled, escapeCapture, escapeStopImmediate);

  const shouldIgnore = useCallback(
    () => ignoreCaptureOverlay?.() ?? false,
    [ignoreCaptureOverlay],
  );

  usePointerDownOutside(hostRef, onDismiss, {
    enabled: enabled && dismissOnOutsideClick,
    shouldIgnore,
  });
}
