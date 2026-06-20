import { useCallback, useRef, type RefObject } from "react";
import {
  applyPanelPosition,
} from "../utils/overlay-layout";

type UseOverlayPanelDragOptions = {
  panelRef: RefObject<HTMLElement | null>;
  headerRef: RefObject<HTMLElement | null>;
  ignoreSelector?: string;
  clampToViewport?: boolean;
  onDragStart?: () => void;
  onDragEnd?: (position: { left: number; top: number }) => void;
};

/** Shared header drag for overlay panels inside shadow DOM (native pointer listeners). */
export function useOverlayPanelDrag({
  panelRef,
  headerRef,
  ignoreSelector = "",
  clampToViewport = false,
  onDragStart,
  onDragEnd,
}: UseOverlayPanelDragOptions): {
  headerProps: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  };
} {
  const offsetRef = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement;
      if (
        target.closest(".closeButton") ||
        (ignoreSelector && target.closest(ignoreSelector))
      ) {
        return;
      }

      const panel = panelRef.current;
      const header = headerRef.current;
      if (!panel || !header) {
        return;
      }

      onDragStart?.();
      header.classList.add("isDragging");

      const rect = panel.getBoundingClientRect();
      offsetRef.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      applyPanelPosition(panel, rect.left, rect.top, clampToViewport);
      header.setPointerCapture(event.pointerId);

      const onPointerMove = (moveEvent: PointerEvent) => {
        applyPanelPosition(
          panel,
          moveEvent.clientX - offsetRef.current.x,
          moveEvent.clientY - offsetRef.current.y,
          clampToViewport,
        );
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        header.classList.remove("isDragging");
        header.removeEventListener("pointermove", onPointerMove);
        header.removeEventListener("pointerup", onPointerUp);
        header.removeEventListener("pointercancel", onPointerUp);
        if (header.hasPointerCapture(upEvent.pointerId)) {
          header.releasePointerCapture(upEvent.pointerId);
        }

        const panelRect = panel.getBoundingClientRect();
        onDragEnd?.({ left: panelRect.left, top: panelRect.top });
      };

      header.addEventListener("pointermove", onPointerMove);
      header.addEventListener("pointerup", onPointerUp);
      header.addEventListener("pointercancel", onPointerUp);
      event.preventDefault();
    },
    [
      clampToViewport,
      headerRef,
      ignoreSelector,
      onDragEnd,
      onDragStart,
      panelRef,
    ],
  );

  return { headerProps: { onPointerDown } };
}

/** TTS overlay: drag the card, clamped to the viewport. */
export function useOverlayDrag(
  cardRef: RefObject<HTMLElement | null>,
  headerRef: RefObject<HTMLElement | null>,
  options: {
    enabled?: boolean;
    ignoreSelector?: string;
    onDragStart?: () => void;
    onDragEnd?: (position: { left: number; top: number }) => void;
  } = {},
) {
  return useOverlayPanelDrag({
    panelRef: cardRef,
    headerRef,
    ignoreSelector: options.ignoreSelector,
    clampToViewport: true,
    onDragStart: options.enabled === false ? undefined : options.onDragStart,
    onDragEnd: options.onDragEnd,
  });
}

/** Transcript overlay: drag the host wrapper, free positioning. */
export function useTranscriptHostDrag(
  hostRef: RefObject<HTMLElement | null>,
  headerRef: RefObject<HTMLElement | null>,
  options: { onDragEnd?: (position: { left: number; top: number }) => void } = {},
) {
  return useOverlayPanelDrag({
    panelRef: hostRef,
    headerRef,
    ignoreSelector: ".iconButton",
    clampToViewport: false,
    onDragEnd: options.onDragEnd,
  });
}
