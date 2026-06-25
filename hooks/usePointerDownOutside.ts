import { useCallback, type RefObject } from "react";
import { useDocumentEvent } from "./useDocumentEvent";

type UsePointerDownOutsideOptions = {
  enabled?: boolean;
  /** Skip outside-click handling (e.g. capture overlay visible, other Motif UI). */
  shouldIgnore?: (event: PointerEvent) => boolean;
};

export function usePointerDownOutside(
  targetRef: RefObject<HTMLElement | null>,
  onOutside: () => void,
  options: UsePointerDownOutsideOptions = {},
): void {
  const { enabled = true, shouldIgnore } = options;

  const handler = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (shouldIgnore?.(event)) {
        return;
      }

      const target = targetRef.current;
      if (!target) {
        return;
      }

      const path = event.composedPath();
      if (path.includes(target)) {
        return;
      }

      onOutside();
    },
    [onOutside, shouldIgnore, targetRef],
  );

  useDocumentEvent("pointerdown", handler, undefined, enabled);
}
