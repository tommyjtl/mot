import { useCallback } from "react";
import { useWindowEvent } from "./useWindowEvent";

export function useEscapeKey(
  onEscape: () => void,
  enabled = true,
  capture = false,
  stopImmediate = false,
): void {
  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      if (stopImmediate) {
        event.stopImmediatePropagation();
      }
      onEscape();
    },
    [onEscape, stopImmediate],
  );

  useWindowEvent("keydown", handler, capture, enabled);
}
