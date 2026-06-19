import type { SelectionPayload, SelectionRect } from "./messages";

export const MAX_SELECTION_LENGTH = 300;

export type SelectionResult =
  | { status: "ok"; payload: SelectionPayload }
  | { status: "empty" }
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

function findLastTextNode(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text;
  }

  for (let index = node.childNodes.length - 1; index >= 0; index -= 1) {
    const found = findLastTextNode(node.childNodes[index]!);
    if (found) {
      return found;
    }
  }

  return null;
}

function findFirstTextNode(node: Node): Text | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text;
  }

  for (let index = 0; index < node.childNodes.length; index += 1) {
    const found = findFirstTextNode(node.childNodes[index]!);
    if (found) {
      return found;
    }
  }

  return null;
}

function previousTextPosition(
  node: Node,
  offset: number,
): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    if (offset > 0) {
      return { node: textNode, offset: offset - 1 };
    }

    let current: Node | null = textNode;
    while (current) {
      if (current.previousSibling) {
        let sibling: Node = current.previousSibling;
        while (sibling.lastChild) {
          sibling = sibling.lastChild;
        }
        if (sibling.nodeType === Node.TEXT_NODE) {
          const text = sibling.textContent ?? "";
          if (text.length > 0) {
            return { node: sibling as Text, offset: text.length - 1 };
          }
        }
        current = sibling;
        continue;
      }

      current = current.parentNode;
    }

    return null;
  }

  if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
    const child = node.childNodes[offset - 1];
    if (child) {
      const textNode = findLastTextNode(child);
      if (textNode) {
        const text = textNode.textContent ?? "";
        if (text.length > 0) {
          return { node: textNode, offset: text.length - 1 };
        }
      }
    }
  }

  return null;
}

function nextTextPosition(
  node: Node,
  offset: number,
): { node: Text; offset: number } | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    const text = textNode.textContent ?? "";
    if (offset < text.length) {
      return { node: textNode, offset };
    }

    let current: Node | null = textNode;
    while (current) {
      if (current.nextSibling) {
        let sibling: Node = current.nextSibling;
        while (sibling.firstChild) {
          sibling = sibling.firstChild;
        }
        if (sibling.nodeType === Node.TEXT_NODE) {
          const siblingText = sibling.textContent ?? "";
          if (siblingText.length > 0) {
            return { node: sibling as Text, offset: 0 };
          }
        }
        current = sibling;
        continue;
      }

      current = current.parentNode;
    }

    return null;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const child = node.childNodes[offset];
    if (child) {
      const textNode = findFirstTextNode(child);
      if (textNode) {
        const text = textNode.textContent ?? "";
        if (text.length > 0) {
          return { node: textNode, offset: 0 };
        }
      }
    }
  }

  return null;
}

/** Expand a DOM range so partial words at each edge become whole words. */
export function expandRangeToWordBoundaries(range: Range): Range {
  const expanded = range.cloneRange();

  while (true) {
    const before = previousTextPosition(
      expanded.startContainer,
      expanded.startOffset,
    );
    if (!before) {
      break;
    }

    const character = before.node.textContent?.[before.offset] ?? "";
    if (!isWordCharacter(character)) {
      break;
    }

    expanded.setStart(before.node, before.offset);
  }

  while (true) {
    const after = nextTextPosition(expanded.endContainer, expanded.endOffset);
    if (!after) {
      break;
    }

    const character = after.node.textContent?.[after.offset] ?? "";
    if (!isWordCharacter(character)) {
      break;
    }

    expanded.setEnd(after.node, after.offset + 1);
  }

  return expanded;
}

function applyExpandedDocumentSelection(range: Range): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
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
    const { start: expandedStart, end: expandedEnd } =
      expandIndicesToWordBoundaries(activeElement.value, start, end);

    activeElement.setSelectionRange(expandedStart, expandedEnd);

    const text = activeElement.value.slice(expandedStart, expandedEnd).trim();
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

  const expandedRange = expandRangeToWordBoundaries(selection.getRangeAt(0));
  applyExpandedDocumentSelection(expandedRange);

  const text = expandedRange.toString().trim();
  if (!text) {
    return null;
  }

  const rect = rectFromRange(expandedRange);
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
