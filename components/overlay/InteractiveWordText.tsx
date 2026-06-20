import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ShadowMountContext } from "./mount-shadow-react";

export type WordRange = {
  start: number | null;
  end?: number | null;
};

type InteractiveWordTextProps = {
  text: string;
  interactive?: boolean;
  shadowRootRef?: RefObject<ShadowRoot | null>;
  innerRef?: RefObject<HTMLElement | null>;
  dataRows?: string;
  highlight?: WordRange | null;
  loading?: WordRange | null;
  className?: string;
  onWordSelect?: (startIndex: number, endIndex: number) => void;
};

function wordIndexInRange(
  wordIndex: number,
  start: number | null,
  end: number | null,
): boolean {
  if (start === null || end === null) {
    return false;
  }

  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return wordIndex >= lo && wordIndex <= hi;
}

function tokenize(text: string): Array<{ kind: "space" | "word"; value: string }> {
  const tokens: Array<{ kind: "space" | "word"; value: string }> = [];
  const regex = /(\S+|\s+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const part = match[0];
    tokens.push({
      kind: /^\s+$/.test(part) ? "space" : "word",
      value: part,
    });
  }

  return tokens;
}

const AUTO_SCROLL_EDGE_PX = 22;
const AUTO_SCROLL_MAX_DELTA = 5;

function autoScrollDelta(
  pointerY: number,
  rect: DOMRect,
  scrollTop: number,
  maxScroll: number,
): number {
  if (maxScroll <= 0) {
    return 0;
  }

  const bottomThreshold = rect.bottom - AUTO_SCROLL_EDGE_PX;
  if (pointerY > bottomThreshold && scrollTop < maxScroll) {
    const intensity = Math.min(
      1,
      (pointerY - bottomThreshold) / AUTO_SCROLL_EDGE_PX,
    );
    const eased = intensity * intensity;
    return Math.round(AUTO_SCROLL_MAX_DELTA * eased);
  }

  const topThreshold = rect.top + AUTO_SCROLL_EDGE_PX;
  if (pointerY < topThreshold && scrollTop > 0) {
    const intensity = Math.min(
      1,
      (topThreshold - pointerY) / AUTO_SCROLL_EDGE_PX,
    );
    const eased = intensity * intensity;
    return -Math.round(AUTO_SCROLL_MAX_DELTA * eased);
  }

  return 0;
}

export function InteractiveWordText({
  text,
  interactive = true,
  shadowRootRef,
  innerRef,
  dataRows,
  highlight,
  loading,
  className,
  onWordSelect,
}: InteractiveWordTextProps) {
  const shadowMount = useContext(ShadowMountContext);
  const containerRef = useRef<HTMLElement | null>(null);
  const [dragPreview, setDragPreview] = useState<WordRange | null>(null);
  const dragAnchorRef = useRef<number | null>(null);
  const dragPointerRef = useRef<number | null>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  const tokens = useMemo(() => tokenize(text), [text]);
  let wordIndex = 0;

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  const wordIndexFromElement = useCallback((element: Element | null): number | null => {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const wordEl = element.closest("[data-word-index]");
    if (!(wordEl instanceof HTMLElement)) {
      return null;
    }

    const index = Number(wordEl.dataset.wordIndex);
    return Number.isFinite(index) ? index : null;
  }, []);

  const wordIndexFromPoint = useCallback(
    (clientX: number, clientY: number): number | null => {
      const shadow = shadowRootRef?.current ?? shadowMount?.shadow ?? null;
      if (!shadow) {
        return null;
      }

      return wordIndexFromElement(shadow.elementFromPoint(clientX, clientY));
    },
    [shadowMount?.shadow, shadowRootRef, wordIndexFromElement],
  );

  const wordIndexFromPointInContainer = useCallback(
    (clientX: number, clientY: number): number | null => {
      const container = containerRef.current;
      if (!container) {
        return wordIndexFromPoint(clientX, clientY);
      }

      const rect = container.getBoundingClientRect();
      const clampedX = Math.min(rect.right - 1, Math.max(rect.left + 1, clientX));
      const clampedY = Math.min(rect.bottom - 1, Math.max(rect.top + 1, clientY));
      return wordIndexFromPoint(clampedX, clampedY);
    },
    [wordIndexFromPoint],
  );

  const updateDragPreviewAtPointer = useCallback(
    (clientX: number, clientY: number) => {
      const anchor = dragAnchorRef.current;
      if (anchor === null) {
        return;
      }

      const index = wordIndexFromPointInContainer(clientX, clientY);
      if (index === null) {
        return;
      }

      setDragPreview({ start: anchor, end: index });
    },
    [wordIndexFromPointInContainer],
  );

  const runAutoScrollStep = useCallback(() => {
    autoScrollRafRef.current = null;

    const container = containerRef.current;
    const pointer = pointerPositionRef.current;

    if (
      !container ||
      !pointer ||
      dragAnchorRef.current === null ||
      dragPointerRef.current === null
    ) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const maxScroll = container.scrollHeight - container.clientHeight;
    const delta = autoScrollDelta(
      pointer.y,
      rect,
      container.scrollTop,
      maxScroll,
    );

    if (delta !== 0) {
      container.scrollTop = Math.min(
        maxScroll,
        Math.max(0, container.scrollTop + delta),
      );
    }

    updateDragPreviewAtPointer(pointer.x, pointer.y);

    const nextDelta = autoScrollDelta(
      pointer.y,
      rect,
      container.scrollTop,
      maxScroll,
    );
    if (nextDelta !== 0) {
      autoScrollRafRef.current = requestAnimationFrame(runAutoScrollStep);
    }
  }, [updateDragPreviewAtPointer]);

  const syncDragAtPointer = useCallback(
    (clientX: number, clientY: number) => {
      pointerPositionRef.current = { x: clientX, y: clientY };
      updateDragPreviewAtPointer(clientX, clientY);

      const container = containerRef.current;
      if (!container || dragPointerRef.current === null) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const maxScroll = container.scrollHeight - container.clientHeight;
      const delta = autoScrollDelta(
        clientY,
        rect,
        container.scrollTop,
        maxScroll,
      );

      if (delta !== 0 && autoScrollRafRef.current === null) {
        autoScrollRafRef.current = requestAnimationFrame(runAutoScrollStep);
      }
    },
    [runAutoScrollStep, updateDragPreviewAtPointer],
  );

  const resetDrag = useCallback(() => {
    stopAutoScroll();
    pointerPositionRef.current = null;
    setDragPreview(null);
    dragAnchorRef.current = null;
    dragPointerRef.current = null;
  }, [stopAutoScroll]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLParagraphElement>) => {
      if (!interactive || !onWordSelect || event.button !== 0) {
        return;
      }

      const index = wordIndexFromElement(event.target as Element);
      if (index === null) {
        return;
      }

      dragAnchorRef.current = index;
      dragPointerRef.current = event.pointerId;
      setDragPreview({ start: index, end: index });
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    },
    [interactive, onWordSelect, wordIndexFromElement],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLParagraphElement>) => {
      if (
        dragAnchorRef.current === null ||
        dragPointerRef.current !== event.pointerId
      ) {
        return;
      }

      syncDragAtPointer(event.clientX, event.clientY);
    },
    [syncDragAtPointer],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLParagraphElement>) => {
      if (
        dragAnchorRef.current === null ||
        dragPointerRef.current !== event.pointerId
      ) {
        return;
      }

      const endIndex =
        wordIndexFromPointInContainer(event.clientX, event.clientY) ??
        dragAnchorRef.current;
      const startIndex = dragAnchorRef.current;

      resetDrag();
      event.currentTarget.releasePointerCapture(event.pointerId);
      onWordSelect?.(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex));
      event.stopPropagation();
    },
    [onWordSelect, resetDrag, wordIndexFromPointInContainer],
  );

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLParagraphElement>) => {
      if (dragPointerRef.current !== event.pointerId) {
        return;
      }

      resetDrag();
    },
    [resetDrag],
  );

  const highlightStart = highlight?.start ?? null;
  const highlightEnd = highlight?.end ?? highlight?.start ?? null;
  const loadingStart = loading?.start ?? null;
  const loadingEnd = loading?.end ?? loading?.start ?? null;
  const previewStart = dragPreview?.start ?? null;
  const previewEnd = dragPreview?.end ?? dragPreview?.start ?? null;

  const setContainerRef = useCallback(
    (node: HTMLParagraphElement | null) => {
      containerRef.current = node;
      if (innerRef) {
        (innerRef as { current: HTMLElement | null }).current = node;
      }
    },
    [innerRef],
  );

  return (
    <p
      ref={setContainerRef}
      data-rows={dataRows}
      className={`${className ?? "wordText"}${dragPreview ? " isSelecting" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {tokens.map((token, tokenIndex) => {
        if (token.kind === "space") {
          return <span key={`space-${tokenIndex}`}>{token.value}</span>;
        }

        const currentWordIndex = wordIndex;
        wordIndex += 1;

        const classes = ["word"];
        if (wordIndexInRange(currentWordIndex, highlightStart, highlightEnd)) {
          classes.push("isActive");
        }
        if (wordIndexInRange(currentWordIndex, loadingStart, loadingEnd)) {
          classes.push("isLoading");
        }
        if (
          wordIndexInRange(currentWordIndex, previewStart, previewEnd) &&
          !wordIndexInRange(currentWordIndex, highlightStart, highlightEnd)
        ) {
          classes.push("isInRange");
        }

        return (
          <span
            key={`word-${tokenIndex}-${currentWordIndex}`}
            className={classes.join(" ")}
            data-word-index={currentWordIndex}
          >
            {token.value}
          </span>
        );
      })}
    </p>
  );
}

export function PlainWordText({
  text,
  className,
  innerRef,
  dataRows,
}: {
  text: string;
  className?: string;
  innerRef?: RefObject<HTMLElement | null>;
  dataRows?: string;
}) {
  return (
    <p
      ref={innerRef as RefObject<HTMLParagraphElement | null>}
      data-rows={dataRows}
      className={className ?? "wordText"}
    >
      {text}
    </p>
  );
}
