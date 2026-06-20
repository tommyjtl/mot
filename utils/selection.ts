import type { SelectionPayload, SelectionRect } from "./messages";

export const MAX_SELECTION_LENGTH = 300;

export type SelectionResult =
  | { status: "ok"; payload: SelectionPayload }
  | { status: "empty" }
  | { status: "ocr" }
  | {
      status: "too_long";
      length: number;
      maxLength: number;
      rect: SelectionRect;
    };

function isWordCharacter(character: string): boolean {
  return /\S/u.test(character);
}

/** Expand slice indices outward to whole-word boundaries within `source`. */
export function expandIndicesToWordBoundaries(
  source: string,
  start: number,
  end: number,
): { start: number; end: number } {
  let expandedStart = start;
  let expandedEnd = end;

  while (expandedStart > 0 && isWordCharacter(source[expandedStart - 1] ?? "")) {
    expandedStart -= 1;
  }

  while (
    expandedEnd < source.length &&
    isWordCharacter(source[expandedEnd] ?? "")
  ) {
    expandedEnd += 1;
  }

  return { start: expandedStart, end: expandedEnd };
}

function toSelectionRect(rect: DOMRect): SelectionRect {
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
    width: rect.width,
    height: rect.height,
  };
}

function rectFromRange(range: Range): DOMRect | null {
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const clientRects = range.getClientRects();
    if (clientRects.length === 0) {
      return null;
    }
    return clientRects[clientRects.length - 1] ?? null;
  }

  return rect;
}

function rectFromActiveInput(
  element: HTMLInputElement | HTMLTextAreaElement,
): DOMRect | null {
  const start = element.selectionStart;
  const end = element.selectionEnd;
  if (start === null || end === null || start === end) {
    return null;
  }

  return element.getBoundingClientRect();
}

function readSelectedText(): { text: string; rect: SelectionRect } | null {
  const activeElement = document.activeElement;

  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement
  ) {
    const rawStart = activeElement.selectionStart;
    const rawEnd = activeElement.selectionEnd;
    if (rawStart === null || rawEnd === null || rawStart === rawEnd) {
      return null;
    }

    const start = Math.min(rawStart, rawEnd);
    const end = Math.max(rawStart, rawEnd);
    const text = activeElement.value.slice(start, end).trim();
    if (!text) {
      return null;
    }

    const rect = rectFromActiveInput(activeElement);
    if (!rect) {
      return null;
    }

    return { text, rect: toSelectionRect(rect) };
  }

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const text = range.toString().trim();
  if (!text) {
    return null;
  }

  const rect = rectFromRange(range);
  if (!rect) {
    return null;
  }

  return { text, rect: toSelectionRect(rect) };
}

export function evaluateSelection(): SelectionResult {
  const selected = readSelectedText();

  if (!selected) {
    return { status: "empty" };
  }

  if (selected.text.length > MAX_SELECTION_LENGTH) {
    return {
      status: "too_long",
      length: selected.text.length,
      maxLength: MAX_SELECTION_LENGTH,
      rect: selected.rect,
    };
  }

  return {
    status: "ok",
    payload: {
      text: selected.text,
      rect: selected.rect,
    },
  };
}

/** @deprecated Use evaluateSelection() */
export function getSelectionPayload(): SelectionPayload | null {
  const result = evaluateSelection();
  return result.status === "ok" ? result.payload : null;
}
