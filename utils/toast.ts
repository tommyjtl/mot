import { hideOverlay } from "./overlay";
import type { SelectionRect } from "./messages";

const TOAST_ID = "mot-selection-toast-host";
const AUTO_DISMISS_MS = 5000;

let dismissTimer: number | null = null;

function positionNearSelection(
  host: HTMLElement,
  card: HTMLElement,
  rect: SelectionRect,
): void {
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.zIndex = "2147483646";
  host.style.pointerEvents = "none";

  card.style.pointerEvents = "auto";

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

  card.style.position = "fixed";
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
}

function clearDismissTimer(): void {
  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

export function hideSelectionToast(): void {
  clearDismissTimer();
  document.getElementById(TOAST_ID)?.remove();
}

export function showSelectionLimitToast(options: {
  length: number;
  maxLength: number;
  rect: SelectionRect;
}): void {
  hideSelectionToast();
  hideOverlay();

  const host = document.createElement("div");
  host.id = TOAST_ID;
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      .card {
        position: relative;
        box-sizing: border-box;
        width: min(360px, calc(100vw - 24px));
        padding: 12px 14px 14px;
        border-radius: 10px;
        border: 1px solid rgba(220, 38, 38, 0.45);
        background: rgba(254, 242, 242, 0.98);
        color: #7f1d1d;
        box-shadow:
          0 10px 30px rgba(220, 38, 38, 0.1),
          0 2px 8px rgba(220, 38, 38, 0.08);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.45;
      }

      .close {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #b91c1c;
        font: inherit;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }

      .close:hover {
        background: rgba(220, 38, 38, 0.1);
        color: #991b1b;
      }

      .message {
        margin: 0 28px 0 0;
        word-break: break-word;
      }

      .count {
        margin: 8px 0 0;
        color: #991b1b;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }
    </style>
    <div class="card">
      <button class="close" type="button" aria-label="Close" title="Close">×</button>
      <p class="message">
        Selection is too long. Select fewer characters to hear pronunciation.
      </p>
      <p class="count"></p>
    </div>
  `;

  const card = shadow.querySelector(".card") as HTMLElement;
  const countEl = shadow.querySelector(".count") as HTMLElement;
  const closeButton = shadow.querySelector(".close") as HTMLButtonElement;

  countEl.textContent = `${options.length} / ${options.maxLength} characters`;

  closeButton.onclick = hideSelectionToast;

  positionNearSelection(host, card, options.rect);

  dismissTimer = window.setTimeout(hideSelectionToast, AUTO_DISMISS_MS);
}
