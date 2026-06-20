/** Click/drag word spans for overlay text (shared pattern with TTS overlay). */

export type WordSelectHandler = (startIndex: number, endIndex: number) => void;

export class InteractiveWordText {
  private wordSpans: HTMLSpanElement[] = [];
  private dragAnchorIndex: number | null = null;
  private dragPointerId: number | null = null;
  private dragBound = false;
  private wordSelectHandler: WordSelectHandler | null = null;

  clearWordSpans(): void {
    for (const span of this.wordSpans) {
      span.classList.remove("is-active", "is-loading", "is-in-range");
    }
    this.wordSpans = [];
  }

  highlight(index: number | null, endIndex?: number | null): void {
    const end = endIndex ?? index;

    for (let wordIndex = 0; wordIndex < this.wordSpans.length; wordIndex += 1) {
      this.wordSpans[wordIndex]?.classList.toggle(
        "is-active",
        this.wordIndexInRange(wordIndex, index, end),
      );
      this.wordSpans[wordIndex]?.classList.remove("is-in-range");
    }
  }

  setLoading(index: number | null, endIndex?: number | null): void {
    const end = endIndex ?? index;

    for (let wordIndex = 0; wordIndex < this.wordSpans.length; wordIndex += 1) {
      this.wordSpans[wordIndex]?.classList.toggle(
        "is-loading",
        this.wordIndexInRange(wordIndex, index, end),
      );
    }
  }

  setPlainText(textEl: HTMLElement, text: string): void {
    this.clearWordSpans();
    textEl.textContent = text;
  }

  renderWithWordSpans(
    textEl: HTMLElement,
    text: string,
    shadow: ShadowRoot,
    onWordSelect: WordSelectHandler,
  ): void {
    this.wordSelectHandler = onWordSelect;
    textEl.replaceChildren();
    this.clearWordSpans();

    const regex = /(\S+|\s+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const part = match[0];
      if (/^\s+$/.test(part)) {
        textEl.appendChild(document.createTextNode(part));
        continue;
      }

      const span = document.createElement("span");
      span.className = "word";
      span.textContent = part;
      textEl.appendChild(span);
      this.wordSpans.push(span);
    }

    this.bindWordDragSelection(textEl, shadow);
  }

  private wordIndexInRange(
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

  private wordIndexFromElement(element: Element | null): number | null {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const wordEl = element.closest(".word");
    if (!(wordEl instanceof HTMLSpanElement)) {
      return null;
    }

    const index = this.wordSpans.indexOf(wordEl);
    return index >= 0 ? index : null;
  }

  private wordIndexFromPoint(
    shadow: ShadowRoot,
    clientX: number,
    clientY: number,
  ): number | null {
    return this.wordIndexFromElement(shadow.elementFromPoint(clientX, clientY));
  }

  private previewWordRange(start: number, end: number): void {
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);

    for (let wordIndex = 0; wordIndex < this.wordSpans.length; wordIndex += 1) {
      this.wordSpans[wordIndex]?.classList.toggle(
        "is-in-range",
        wordIndex >= lo && wordIndex <= hi,
      );
    }
  }

  private clearWordRangePreview(): void {
    for (const span of this.wordSpans) {
      span.classList.remove("is-in-range");
    }
  }

  private resetWordDragState(textEl: HTMLElement): void {
    this.clearWordRangePreview();
    textEl.classList.remove("is-selecting");
    this.dragAnchorIndex = null;
    this.dragPointerId = null;
  }

  private bindWordDragSelection(textEl: HTMLElement, shadow: ShadowRoot): void {
    if (this.dragBound) {
      return;
    }

    this.dragBound = true;

    textEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const index = this.wordIndexFromElement(event.target as Element);
      if (index === null) {
        return;
      }

      this.dragAnchorIndex = index;
      this.dragPointerId = event.pointerId;
      textEl.classList.add("is-selecting");
      textEl.setPointerCapture(event.pointerId);
      this.previewWordRange(index, index);
      event.preventDefault();
      event.stopPropagation();
    });

    textEl.addEventListener("pointermove", (event) => {
      if (this.dragAnchorIndex === null || this.dragPointerId !== event.pointerId) {
        return;
      }

      const index = this.wordIndexFromPoint(shadow, event.clientX, event.clientY);
      if (index === null) {
        return;
      }

      this.previewWordRange(this.dragAnchorIndex, index);
    });

    const finishDrag = (event: PointerEvent): void => {
      if (this.dragAnchorIndex === null || this.dragPointerId !== event.pointerId) {
        return;
      }

      const endIndex =
        this.wordIndexFromPoint(shadow, event.clientX, event.clientY) ??
        this.dragAnchorIndex;
      const startIndex = this.dragAnchorIndex;

      this.resetWordDragState(textEl);
      textEl.releasePointerCapture(event.pointerId);

      this.wordSelectHandler?.(
        Math.min(startIndex, endIndex),
        Math.max(startIndex, endIndex),
      );
      event.stopPropagation();
    };

    textEl.addEventListener("pointerup", finishDrag);
    textEl.addEventListener("pointercancel", (event) => {
      if (this.dragPointerId !== event.pointerId) {
        return;
      }

      this.resetWordDragState(textEl);
    });
  }
}
