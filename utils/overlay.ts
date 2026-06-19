import type { SelectionRect } from "./messages";

const OVERLAY_ID = "mot-tts-overlay-host";
const OVERLAY_TEMPLATE_VERSION = "4";

export type PlaybackState = "idle" | "playing";

export type OverlayState =
  | { kind: "loading-model"; text: string; detail?: string; percent?: number }
  | { kind: "generating"; text: string; detail?: string; percent?: number }
  | {
      kind: "ready";
      text: string;
      hint?: string;
      playback: PlaybackState;
      onTogglePlayback: () => void;
      onWordClick?: (wordIndex: number, wordText: string) => void;
    }
  | { kind: "error"; message: string; text?: string };

export type TranslationViewState =
  | { visible: false }
  | {
      visible: true;
      originalText: string;
      translationText: string;
      mode: "full" | "word";
      loading?: boolean;
    };

type OverlayElements = {
  host: HTMLElement;
  shadow: ShadowRoot;
  card: HTMLElement;
  header: HTMLElement;
  translationSection: HTMLElement;
  translationRestoreRow: HTMLElement;
  translationOriginalValueEl: HTMLElement;
  translationGlossValueEl: HTMLElement;
  translationRestoreBtn: HTMLButtonElement;
  textEl: HTMLElement;
  statusEl: HTMLElement;
  actionButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
};

let dragCleanup: (() => void) | null = null;
let overlayDragBound = false;
let userMovedOverlay = false;

function bindOverlayDrag(
  host: HTMLElement,
  card: HTMLElement,
  header: HTMLElement,
): void {
  if (overlayDragBound) {
    return;
  }

  overlayDragBound = true;
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const clampPosition = (left: number, top: number): { left: number; top: number } => {
    const margin = 8;
    const cardWidth = card.offsetWidth || card.getBoundingClientRect().width;
    const cardHeight = card.offsetHeight || card.getBoundingClientRect().height;

    return {
      left: Math.max(margin, Math.min(left, window.innerWidth - cardWidth - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - cardHeight - margin)),
    };
  };

  const applyPosition = (left: number, top: number): void => {
    const clamped = clampPosition(left, top);
    card.style.position = "fixed";
    card.style.left = `${clamped.left}px`;
    card.style.top = `${clamped.top}px`;
    card.style.right = "auto";
  };

  const stopDragging = (pointerId: number): void => {
    if (!dragging) {
      return;
    }

    dragging = false;
    header.classList.remove("is-dragging");
    host.style.cursor = "";
    if (header.hasPointerCapture(pointerId)) {
      header.releasePointerCapture(pointerId);
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if ((event.target as HTMLElement).closest(".close")) {
      return;
    }

    dragging = true;
    userMovedOverlay = true;
    header.classList.add("is-dragging");
    host.style.cursor = "grabbing";
    header.setPointerCapture(event.pointerId);

    const rect = card.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) {
      return;
    }

    applyPosition(event.clientX - offsetX, event.clientY - offsetY);
  };

  const onPointerUp = (event: PointerEvent): void => {
    stopDragging(event.pointerId);
  };

  header.addEventListener("pointerdown", onPointerDown);
  header.addEventListener("pointermove", onPointerMove);
  header.addEventListener("pointerup", onPointerUp);
  header.addEventListener("pointercancel", onPointerUp);

  dragCleanup = () => {
    header.removeEventListener("pointerdown", onPointerDown);
    header.removeEventListener("pointermove", onPointerMove);
    header.removeEventListener("pointerup", onPointerUp);
    header.removeEventListener("pointercancel", onPointerUp);
    overlayDragBound = false;
  };
}

function ensureOverlay(): OverlayElements {
  let host = document.getElementById(OVERLAY_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = OVERLAY_ID;
    document.documentElement.appendChild(host);
  }

  let shadow = host.shadowRoot;
  const templateVersion = shadow
    ?.querySelector("[data-template-version]")
    ?.getAttribute("data-template-version");

  if (!shadow || templateVersion !== OVERLAY_TEMPLATE_VERSION) {
    if (shadow) {
      dragCleanup?.();
      dragCleanup = null;
      overlayDragBound = false;
    } else {
      shadow = host.attachShadow({ mode: "open" });
    }

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }

        .card {
          position: relative;
          box-sizing: border-box;
          width: min(360px, calc(100vw - 24px));
          padding: 0;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255, 255, 255, 0.98);
          color: #0f172a;
          box-shadow:
            0 10px 30px rgba(15, 23, 42, 0.12),
            0 2px 8px rgba(15, 23, 42, 0.08);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px;
          line-height: 1.45;
          overflow: hidden;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          min-height: 0;
          padding: 4px 6px 4px 8px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          background: linear-gradient(
            180deg,
            rgba(248, 250, 252, 0.98) 0%,
            rgba(241, 245, 249, 0.98) 100%
          );
          cursor: grab;
          user-select: none;
          touch-action: none;
        }

        .header.is-dragging {
          cursor: grabbing;
        }

        .drag-handle {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 2px;
          width: 12px;
          height: 12px;
          pointer-events: none;
        }

        .drag-handle span {
          display: block;
          height: 1.5px;
          border-radius: 999px;
          background: #94a3b8;
        }

        .header-title {
          flex: 1;
          margin: 0;
          color: #64748b;
          font-size: 11px;
          font-weight: 500;
          line-height: 1;
          letter-spacing: 0.01em;
          pointer-events: none;
        }

        .close {
          margin-left: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          padding: 0;
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: #64748b;
          font: inherit;
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
        }

        .close:hover {
          background: rgba(15, 23, 42, 0.06);
          color: #0f172a;
        }

        .body {
          padding: 12px 14px 14px;
        }

        .translation-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 8px;
        }

        .translation-restore-row[hidden] {
          display: none;
        }

        .translation-restore-row {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 2px;
        }

        .translation-line {
          margin: 0;
          min-width: 0;
          font-size: 14px;
          line-height: 1.4;
          color: #334155;
        }

        .translation-line-original {
          width: 100%;
        }

        .translation-line-gloss {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }

        .translation-gloss-main {
          flex: 1;
          min-width: 0;
        }

        .translation-ipa-value {
          flex-shrink: 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 400;
          font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
          white-space: nowrap;
        }

        .translation-ipa-value[hidden] {
          display: none;
        }

        .translation-label {
          color: #64748b;
          font-weight: 400;
          margin-right: 0.35em;
        }

        .translation-original-value {
          font-weight: 400;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .translation-gloss-value {
          font-weight: 700;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .translation-gloss-value.is-loading {
          font-weight: 400;
          color: #64748b;
        }

        .translation-restore {
          appearance: none;
          border: 0;
          background: transparent;
          color: #64748b;
          font: inherit;
          font-size: 12px;
          line-height: 1.35;
          cursor: pointer;
          margin: 0;
          padding: 0;
          text-align: right;
          white-space: nowrap;
        }

        .translation-restore:hover {
          color: #0f172a;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .translation-divider {
          border: 0;
          border-top: 1px solid rgba(15, 23, 42, 0.1);
          margin: 6px 0 0;
        }

        .text {
          font-size: 1.75rem;
          margin: 0 0 10px;
          max-height: min(40vh, 320px);
          overflow-y: auto;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .word {
          cursor: pointer;
          border-radius: 3px;
        }

        .word:hover:not(.is-active):not(.is-loading) {
          background: rgba(79, 70, 229, 0.1);
        }

        .word.is-loading {
          opacity: 0.65;
        }

        .word.is-active {
          background-color: rgb(250 204 21);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          border-radius: 3px;
          padding: 0 1px;
        }

        .status {
          margin: 0;
          color: #475569;
          font-size: 13px;
        }

        .progress-track {
          height: 6px;
          margin-top: 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          width: 0%;
          border-radius: inherit;
          background: #4f46e5;
          transition: width 180ms ease;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .action {
          appearance: none;
          border: 1px solid rgba(15, 23, 42, 0.14);
          background: #f8fafc;
          color: #0f172a;
          border-radius: 8px;
          padding: 6px 10px;
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }

        .action:hover {
          background: #eef2ff;
          border-color: rgba(79, 70, 229, 0.35);
        }

        .action.is-playing {
          background: #fef2f2;
          border-color: rgba(220, 38, 38, 0.25);
          color: #991b1b;
        }

        .action.is-playing:hover {
          background: #fee2e2;
          border-color: rgba(220, 38, 38, 0.4);
        }

        .error {
          color: #b91c1c;
        }

        .spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          margin-right: 6px;
          border: 2px solid rgba(71, 85, 105, 0.25);
          border-top-color: #475569;
          border-radius: 50%;
          vertical-align: -2px;
          animation: mot-spin 0.8s linear infinite;
        }

        @keyframes mot-spin {
          to {
            transform: rotate(360deg);
          }
        }
      </style>
      <div class="card" part="card" data-template-version="${OVERLAY_TEMPLATE_VERSION}">
        <header class="header" aria-label="Drag pronunciation panel">
          <div class="drag-handle" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <button class="close" type="button" aria-label="Close" title="Close">×</button>
        </header>
        <div class="body">
          <section class="translation-section" hidden>
            <div class="translation-restore-row" hidden>
              <button class="translation-restore" type="button">
                Show full translation
              </button>
            </div>
            <p class="translation-line translation-line-original">
              <span class="translation-label">Original:</span>
              <span class="translation-original-value"></span>
            </p>
            <p class="translation-line translation-line-gloss">
              <span class="translation-gloss-main">
                <span class="translation-label">Translation:</span>
                <span class="translation-gloss-value"></span>
              </span>
              <span class="translation-ipa-value" hidden></span>
            </p>
            <hr class="translation-divider" />
          </section>
          <p class="text"></p>
          <div class="actions">
            <button class="action" type="button" hidden>Listen</button>
            <p class="status"></p>
          </div>
        </div>
      </div>
    `;
  }

  const card = shadow.querySelector(".card") as HTMLElement;
  const header = shadow.querySelector(".header") as HTMLElement;
  const translationSection = shadow.querySelector(
    ".translation-section",
  ) as HTMLElement;
  const translationRestoreRow = shadow.querySelector(
    ".translation-restore-row",
  ) as HTMLElement;
  const translationOriginalValueEl = shadow.querySelector(
    ".translation-original-value",
  ) as HTMLElement;
  const translationGlossValueEl = shadow.querySelector(
    ".translation-gloss-value",
  ) as HTMLElement;
  const translationRestoreBtn = shadow.querySelector(
    ".translation-restore",
  ) as HTMLButtonElement;
  const textEl = shadow.querySelector(".text") as HTMLElement;
  const statusEl = shadow.querySelector(".status") as HTMLElement;
  const actionButton = shadow.querySelector(".action") as HTMLButtonElement;
  const closeButton = shadow.querySelector(".close") as HTMLButtonElement;

  bindOverlayDrag(host, card, header);

  return {
    host,
    shadow,
    card,
    header,
    translationSection,
    translationRestoreRow,
    translationOriginalValueEl,
    translationGlossValueEl,
    translationRestoreBtn,
    textEl,
    statusEl,
    actionButton,
    closeButton,
  };
}

function applyPlaybackState(
  actionButton: HTMLButtonElement,
  playback: PlaybackState,
): void {
  actionButton.textContent =
    playback === "playing" ? "Stop pronunciation" : "Listen";
  actionButton.classList.toggle("is-playing", playback === "playing");
}

function positionOverlay(host: HTMLElement, card: HTMLElement, rect: SelectionRect) {
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.zIndex = "2147483647";
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
  card.style.right = "auto";
}

function placeOverlayDefault(card: HTMLElement): void {
  card.style.position = "fixed";
  card.style.top = "16px";
  card.style.right = "16px";
  card.style.left = "auto";
}

let toggleHandler: (() => void) | null = null;
let closeHandler: (() => void) | null = null;
let wordClickHandler: ((wordIndex: number, wordText: string) => void) | null =
  null;
let translationRestoreHandler: (() => void) | null = null;
let wordSpans: HTMLSpanElement[] = [];

function hideTranslationSection(
  translationSection: HTMLElement,
  translationRestoreRow: HTMLElement,
  translationRestoreBtn: HTMLButtonElement,
): void {
  translationSection.hidden = true;
  translationRestoreRow.hidden = true;
  translationRestoreBtn.onclick = null;
  translationRestoreHandler = null;
}

export function setOverlayTranslation(
  state: TranslationViewState,
  onRestoreFull?: () => void,
): void {
  const host = document.getElementById(OVERLAY_ID);
  const translationSection = host?.shadowRoot?.querySelector(
    ".translation-section",
  ) as HTMLElement | undefined;
  const translationRestoreRow = host?.shadowRoot?.querySelector(
    ".translation-restore-row",
  ) as HTMLElement | undefined;
  const translationOriginalValueEl = host?.shadowRoot?.querySelector(
    ".translation-original-value",
  ) as HTMLElement | undefined;
  const translationGlossValueEl = host?.shadowRoot?.querySelector(
    ".translation-gloss-value",
  ) as HTMLElement | undefined;
  const translationRestoreBtn = host?.shadowRoot?.querySelector(
    ".translation-restore",
  ) as HTMLButtonElement | undefined;

  if (
    !translationSection ||
    !translationRestoreRow ||
    !translationOriginalValueEl ||
    !translationGlossValueEl ||
    !translationRestoreBtn
  ) {
    return;
  }

  if (!state.visible) {
    hideTranslationSection(
      translationSection,
      translationRestoreRow,
      translationRestoreBtn,
    );
    return;
  }

  translationSection.hidden = false;
  translationOriginalValueEl.textContent = state.originalText;
  translationGlossValueEl.textContent = state.loading
    ? "Translating…"
    : state.translationText;
  translationGlossValueEl.classList.toggle("is-loading", state.loading === true);
  translationRestoreRow.hidden =
    state.mode !== "word" || state.loading === true;
  translationRestoreHandler = onRestoreFull ?? null;
  translationRestoreBtn.onclick = () => {
    translationRestoreHandler?.();
  };
}

function clearWordSpans(): void {
  for (const span of wordSpans) {
    span.classList.remove("is-active", "is-loading");
  }
  wordSpans = [];
}

export function highlightOverlayWord(index: number | null): void {
  for (let wordIndex = 0; wordIndex < wordSpans.length; wordIndex += 1) {
    wordSpans[wordIndex]?.classList.toggle(
      "is-active",
      index !== null && wordIndex === index,
    );
  }
}

export function setWordLoadingIndex(index: number | null): void {
  for (let wordIndex = 0; wordIndex < wordSpans.length; wordIndex += 1) {
    wordSpans[wordIndex]?.classList.toggle(
      "is-loading",
      index !== null && wordIndex === index,
    );
  }
}

export function setOverlayStatusMessage(message: string): void {
  const statusEl = document.getElementById(OVERLAY_ID)?.shadowRoot?.querySelector(
    ".status",
  ) as HTMLElement | undefined;

  if (statusEl) {
    statusEl.textContent = message;
    statusEl.classList.remove("error");
  }
}

function renderTextWithWordSpans(textEl: HTMLElement, text: string): void {
  textEl.replaceChildren();
  clearWordSpans();

  const regex = /(\S+|\s+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const part = match[0];
    if (/^\s+$/.test(part)) {
      textEl.appendChild(document.createTextNode(part));
      continue;
    }

    const wordIndex = wordSpans.length;
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = part;
    span.title = "Click to hear this word";
    span.addEventListener("click", (event) => {
      event.stopPropagation();
      wordClickHandler?.(wordIndex, part);
    });
    textEl.appendChild(span);
    wordSpans.push(span);
  }
}

function setPlainText(textEl: HTMLElement, text: string): void {
  clearWordSpans();
  textEl.textContent = text;
}

function renderLoadingStatus(
  statusEl: HTMLElement,
  phase: "loading-model" | "generating",
  detail?: string,
  percent?: number,
): void {
  const label =
    detail ??
    (phase === "loading-model" ? "Loading model…" : "Generating pronunciation…");
  const suffix =
    typeof percent === "number" && phase === "loading-model" ? ` ${percent}%` : "";

  statusEl.innerHTML = `
    <span class="spinner"></span>${escapeHtml(`${label}${suffix}`)}
    ${typeof percent === "number" && phase === "loading-model"
      ? `<div class="progress-track"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, percent))}%"></div></div>`
      : ""
    }
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function updateOverlayProgress(
  phase: "loading-model" | "generating",
  detail?: string,
  percent?: number,
): void {
  const host = document.getElementById(OVERLAY_ID);
  const statusEl = host?.shadowRoot?.querySelector(".status") as
    | HTMLElement
    | undefined;

  if (!statusEl || !host || host.style.display === "none") {
    return;
  }

  statusEl.classList.remove("error");
  renderLoadingStatus(statusEl, phase, detail, percent);
}

export function hideOverlay(): void {
  clearWordSpans();
  dragCleanup?.();
  dragCleanup = null;
  userMovedOverlay = false;
  translationRestoreHandler = null;
  document.getElementById(OVERLAY_ID)?.remove();
  toggleHandler = null;
  closeHandler = null;
  wordClickHandler = null;
}

export function updatePlaybackState(playback: PlaybackState): void {
  const host = document.getElementById(OVERLAY_ID);
  const actionButton = host?.shadowRoot?.querySelector(".action") as
    | HTMLButtonElement
    | undefined;

  if (!actionButton || actionButton.hidden) {
    return;
  }

  applyPlaybackState(actionButton, playback);
}

export function showOverlay(
  state: OverlayState,
  rect?: SelectionRect,
  onClose?: () => void,
): void {
  const {
    host,
    card,
    translationSection,
    translationRestoreRow,
    translationRestoreBtn,
    textEl,
    statusEl,
    actionButton,
    closeButton,
  } = ensureOverlay();

  hideTranslationSection(
    translationSection,
    translationRestoreRow,
    translationRestoreBtn,
  );
  actionButton.hidden = true;
  actionButton.onclick = null;
  actionButton.classList.remove("is-playing");
  statusEl.classList.remove("error");
  statusEl.innerHTML = "";

  closeHandler = onClose ?? null;
  closeButton.onclick = () => {
    closeHandler?.();
  };

  if (state.kind === "loading-model") {
    setPlainText(textEl, state.text);
    renderLoadingStatus(
      statusEl,
      "loading-model",
      state.detail,
      state.percent,
    );
  }

  if (state.kind === "generating") {
    setPlainText(textEl, state.text);
    renderLoadingStatus(statusEl, "generating", state.detail, state.percent);
  }

  if (state.kind === "ready") {
    wordClickHandler = state.onWordClick ?? null;
    renderTextWithWordSpans(textEl, state.text);
    statusEl.textContent = state.hint ?? "Click a word to hear it on its own.";
    actionButton.hidden = false;
    applyPlaybackState(actionButton, state.playback);
    toggleHandler = state.onTogglePlayback;
    actionButton.onclick = () => toggleHandler?.();
  }

  if (state.kind === "error") {
    setPlainText(textEl, state.text ?? "");
    statusEl.textContent = state.message;
    statusEl.classList.add("error");
  }

  host.style.display = "block";
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
  card.style.pointerEvents = "auto";

  if (!userMovedOverlay) {
    if (rect) {
      positionOverlay(host, card, rect);
    } else {
      placeOverlayDefault(card);
    }
  }
}

export function bindOverlayDismissals(onDismiss?: () => void): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onDismiss?.();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
