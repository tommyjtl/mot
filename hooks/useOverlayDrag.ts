import { useCallback, useRef, type RefObject } from "react";

type UseOverlayPanelDragOptions = {
  panelRef: RefObject<HTMLElement | null>;
  headerRef: RefObject<HTMLElement | null>;
  ignoreSelector?: string;
  clampToViewport?: boolean;
  onDragStart?: () => void;
};

function clampPanelPosition(
  panel: HTMLElement,
  left: number,
  top: number,
): { left: number; top: number } {
  const margin = 8;
  const width = panel.offsetWidth || panel.getBoundingClientRect().width;
  const height = panel.offsetHeight || panel.getBoundingClientRect().height;

  return {
    left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
  };
}

function applyPanelPosition(
  panel: HTMLElement,
  left: number,
  top: number,
  clampToViewport: boolean,
): void {
  const resolved = clampToViewport
    ? clampPanelPosition(panel, left, top)
    : { left, top };

  panel.style.position = "fixed";
  panel.style.left = `${resolved.left}px`;
  panel.style.top = `${resolved.top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.style.transform = "none";
}

/** Shared header drag for overlay panels inside shadow DOM (native pointer listeners). */
export function useOverlayPanelDrag({
  panelRef,
  headerRef,
  ignoreSelector = "",
  clampToViewport = false,
  onDragStart,
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

      applyPanelPosition(
        panel,
        rect.left,
        rect.top,
        clampToViewport,
      );
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
      };

      header.addEventListener("pointermove", onPointerMove);
      header.addEventListener("pointerup", onPointerUp);
      header.addEventListener("pointercancel", onPointerUp);
      event.preventDefault();
    },
    [clampToViewport, headerRef, ignoreSelector, onDragStart, panelRef],
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
  } = {},
) {
  return useOverlayPanelDrag({
    panelRef: cardRef,
    headerRef,
    ignoreSelector: options.ignoreSelector,
    clampToViewport: true,
    onDragStart: options.enabled === false ? undefined : options.onDragStart,
  });
}

/** Transcript overlay: drag the host wrapper, free positioning. */
export function useTranscriptHostDrag(
  hostRef: RefObject<HTMLElement | null>,
  headerRef: RefObject<HTMLElement | null>,
) {
  return useOverlayPanelDrag({
    panelRef: hostRef,
    headerRef,
    ignoreSelector: ".iconButton",
    clampToViewport: false,
  });
}

export function positionCardNearSelection(
  card: HTMLElement,
  rect: { top: number; left: number; bottom: number; right: number },
): void {
  const margin = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const cardWidth = card.offsetWidth || 280;
  const cardHeight = card.offsetHeight || 80;

  let top = rect.bottom + margin;
  let left = rect.left;

  if (top + cardHeight > viewportHeight - margin) {
    top = rect.top - cardHeight - margin;
  }

  left = Math.max(margin, Math.min(left, viewportWidth - cardWidth - margin));
  top = Math.max(margin, Math.min(top, viewportHeight - cardHeight - margin));

  applyPanelPosition(card, left, top, false);
}

export function placeCardDefault(card: HTMLElement): void {
  card.style.position = "fixed";
  card.style.top = "16px";
  card.style.right = "16px";
  card.style.left = "auto";
  card.style.bottom = "auto";
}
