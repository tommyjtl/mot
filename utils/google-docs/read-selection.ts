import type { SelectionRect } from "../messages";
import { isGoogleDocsDocumentPage } from "./page";

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

function offsetRectByIframe(rect: DOMRect, iframe: HTMLIFrameElement): DOMRect {
  const iframeRect = iframe.getBoundingClientRect();
  return new DOMRect(
    rect.left + iframeRect.left,
    rect.top + iframeRect.top,
    rect.width,
    rect.height,
  );
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

function readTextFromTextarea(textarea: HTMLTextAreaElement): string | null {
  const rawStart = textarea.selectionStart;
  const rawEnd = textarea.selectionEnd;
  if (rawStart === null || rawEnd === null || rawStart === rawEnd) {
    return null;
  }

  const start = Math.min(rawStart, rawEnd);
  const end = Math.max(rawStart, rawEnd);
  const text = textarea.value.slice(start, end).trim();
  return text || null;
}

function rectFromAnnotatedSelectionOverlay(): DOMRect | null {
  const rects = document.querySelectorAll(".kix-canvas-tile-selection svg rect");
  if (rects.length === 0) {
    return null;
  }

  let top = Number.POSITIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const node of rects) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      continue;
    }

    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  if (!Number.isFinite(top)) {
    return null;
  }

  return new DOMRect(left, top, right - left, bottom - top);
}

function readFromFrameWindow(
  frameWindow: Window,
  iframe: HTMLIFrameElement,
): { text: string; rect: SelectionRect } | null {
  const selection = frameWindow.getSelection();
  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const text = range.toString().trim();
    const rangeRect = rectFromRange(range);
    const overlayRect = rectFromAnnotatedSelectionOverlay();
    const resolvedRect = rangeRect
      ? offsetRectByIframe(rangeRect, iframe)
      : overlayRect;
    if (text && resolvedRect) {
      return {
        text,
        rect: toSelectionRect(resolvedRect),
      };
    }
  }

  const textarea = frameWindow.document.querySelector("textarea");
  if (textarea instanceof HTMLTextAreaElement) {
    const text = readTextFromTextarea(textarea);
    if (text) {
      const overlayRect = rectFromAnnotatedSelectionOverlay();
      const fallbackRect =
        overlayRect ?? offsetRectByIframe(textarea.getBoundingClientRect(), iframe);
      return {
        text,
        rect: toSelectionRect(fallbackRect),
      };
    }
  }

  return null;
}

/**
 * Read the current selection on a Google Docs document page.
 * Requires annotated canvas mode (see google-docs-annotate content script).
 */
export function readGoogleDocsSelection(): { text: string; rect: SelectionRect } | null {
  if (!isGoogleDocsDocumentPage()) {
    return null;
  }

  const iframe = document.querySelector(".docs-texteventtarget-iframe");
  if (!(iframe instanceof HTMLIFrameElement)) {
    return null;
  }

  const frameWindow = iframe.contentWindow;
  if (frameWindow) {
    const fromFrame = readFromFrameWindow(frameWindow, iframe);
    if (fromFrame) {
      return fromFrame;
    }
  }

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLIFrameElement && activeElement.contentWindow) {
    const fromActiveFrame = readFromFrameWindow(activeElement.contentWindow, activeElement);
    if (fromActiveFrame) {
      return fromActiveFrame;
    }
  }

  return null;
}
