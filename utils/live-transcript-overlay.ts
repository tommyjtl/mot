import { InteractiveWordText } from "./interactive-word-text";

const OVERLAY_ID = "mot-transcript-overlay-host";
const TEMPLATE_VERSION = "17";
const WAITING_PLACEHOLDER = "Waiting for transcription";
const MAX_VISIBLE_LINES = 2;

export const MAX_VISIBLE_TRANSCRIPT_LINES = MAX_VISIBLE_LINES;

export type TranscriptWordTranslationState =
  | { visible: false }
  | {
    visible: true;
    originalText: string;
    translationText: string;
    loading?: boolean;
  };

let onStop: (() => void) | null = null;
let onResume: (() => void) | null = null;
let onClose: (() => void) | null = null;
let onReset: (() => void) | null = null;
let onTranscriptEdited: ((text: string) => void) | null = null;
let onWordSelect: ((startIndex: number, endIndex: number) => void) | null = null;
let onStopPlayback: (() => void) | null = null;
const interactiveWordText = new InteractiveWordText();
let transcriptRowCount = 1;
let streamingUiReady = false;
let transcriptEditMode = false;
let overlayActivity: "idle" | "streaming" | "paused" = "idle";
let headerPrimaryMode: "stop" | "resume" | "hidden" = "hidden";

export type TranscriptOverlayState =
  | { kind: "loading"; detail: string; percent?: number }
  | { kind: "streaming"; lines: string[]; partial: string }
  | { kind: "paused"; lines: string[] }
  | { kind: "needs-capture"; message?: string }
  | { kind: "error"; message: string };

type TranscriptOverlayElements = {
  host: HTMLElement;
  card: HTMLElement;
  header: HTMLElement;
  headerSpinner: HTMLElement;
  headerPauseIcon: HTMLElement;
  bodyEl: HTMLElement;
  transcriptEl: HTMLElement;
  statusEl: HTMLElement;
  allowButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  editButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  translationSection: HTMLElement;
  translationOriginalValueEl: HTMLElement;
  translationGlossValueEl: HTMLElement;
  playbackButton: HTMLButtonElement;
  shadow: ShadowRoot;
};

const STOP_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>`;
const RESUME_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>`;
const EDIT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>`;
const CHECK_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>`;
const SPEAKER_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" /><path class="speaker-wave speaker-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path class="speaker-wave speaker-wave-2" d="M17.66 6.34a8 8 0 0 1 0 11.32" /></svg>`;
const PLAYBACK_STOP_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>`;

function getTranscriptText(transcriptEl: HTMLElement): string {
  return transcriptEl.textContent ?? "";
}

function setTranscriptText(transcriptEl: HTMLElement, text: string): void {
  transcriptEl.textContent = text;
}

function focusTranscriptEnd(transcriptEl: HTMLElement): void {
  if (transcriptEl.childNodes.length === 0) {
    transcriptEl.appendChild(document.createTextNode(""));
  }

  transcriptEl.focus();
  const range = document.createRange();
  range.selectNodeContents(transcriptEl);
  range.collapse(false);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function setTranscriptContentEditable(
  transcriptEl: HTMLElement,
  enabled: boolean,
): void {
  transcriptEl.contentEditable = enabled ? "true" : "false";
}

function ensureOverlay(): TranscriptOverlayElements {
  let host = document.getElementById(OVERLAY_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = OVERLAY_ID;
    document.documentElement.appendChild(host);
  }

  if (!host.shadowRoot) {
    host.attachShadow({ mode: "open" });
  }

  const shadow = host.shadowRoot!;
  const version = shadow
    .querySelector(".card")
    ?.getAttribute("data-template-version");
  const needsTemplate = version !== TEMPLATE_VERSION;

  if (needsTemplate) {
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }

        .host {
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%);
          z-index: 2147483647;
          pointer-events: none;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .card {
          pointer-events: auto;
          width: min(420px, calc(100vw - 24px));
          border-radius: 14px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #ffffff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
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
          background: #f8fafc;
          cursor: grab;
          user-select: none;
        }

        .header .header-icon {
          cursor: pointer;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .header-spinner {
          display: none;
          width: 12px;
          height: 12px;
          flex: 0 0 auto;
          border: 2px solid rgba(71, 85, 105, 0.25);
          border-top-color: #475569;
          border-radius: 50%;
          animation: mot-transcript-spin 0.8s linear infinite;
        }

        .header-spinner.is-visible {
          display: inline-block;
        }

        .header-pause {
          display: none;
          width: 12px;
          height: 12px;
          flex: 0 0 auto;
          color: #64748b;
        }

        .header-pause.is-visible {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-pause svg {
          width: 12px;
          height: 12px;
          display: block;
        }

        .header:active {
          cursor: grabbing;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .header-icon {
          appearance: none;
          border: 0;
          background: transparent;
          color: #64748b;
          width: 20px;
          height: 20px;
          padding: 0;
          border-radius: 4px;
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon:hover {
          background: rgba(15, 23, 42, 0.06);
          color: #0f172a;
        }

        .header-icon svg {
          width: 16px;
          height: 16px;
          display: block;
        }

        .header-icon[hidden] {
          display: none;
        }

        .title {
          margin: 0;
          font-size: 11px;
          font-weight: 500;
          line-height: 1;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #64748b;
        }

        .body {
          padding: 12px 14px 10px;
        }

        .transcript {
          display: block;
          width: 100%;
          box-sizing: border-box;
          margin: 0;
          border: 0;
          padding: 0;
          background: transparent;
          font-family: inherit;
          font-size: 1.75rem;
          line-height: 1.45;
          color: #0f172a;
          overflow-x: hidden;
          overflow-y: auto;
          outline: none;
          word-break: break-word;
          white-space: pre-wrap;
          height: calc(1.45em * 1);
          min-height: calc(1.45em * 1);
          max-height: calc(1.45em * 2);
        }

        .transcript.is-expanded {
          height: calc(1.45em * 2);
        }

        .transcript.is-placeholder {
          color: #94a3b8;
          font-style: italic;
        }

        .transcript.is-editing {
          background: #f1f5f9;
          border-radius: 6px;
          cursor: text;
        }

        .transcript.is-read-mode .word {
          cursor: pointer;
          border-radius: 3px;
        }

        .transcript.is-read-mode .word:hover:not(.is-active):not(.is-loading) {
          background: rgba(79, 70, 229, 0.1);
        }

        .transcript.is-read-mode .word.is-loading {
          opacity: 0.65;
        }

        .transcript.is-read-mode.is-selecting {
          user-select: none;
          cursor: text;
        }

        .transcript.is-read-mode .word.is-in-range:not(.is-active):not(.is-loading) {
          background: rgba(79, 70, 229, 0.18);
        }

        .transcript.is-read-mode .word.is-active {
          background-color: rgb(250 204 21);
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          border-radius: 3px;
          padding: 0 1px;
        }

        .translation-section[hidden] {
          display: none;
        }

        .translation-section:not([hidden]) {
          display: block;
          margin-bottom: 8px;
        }

        .translation-line {
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .translation-line + .translation-line {
          margin-top: 6px;
        }

        .translation-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .translation-original-value,
        .translation-gloss-value {
          font-size: 1.75rem;
          font-weight: 700;
          line-height: 1.45;
          color: #0f172a;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .translation-gloss-value.is-loading {
          font-weight: 400;
          color: #64748b;
          font-style: italic;
        }

        .translation-divider {
          border: 0;
          border-top: 1px solid rgba(15, 23, 42, 0.1);
          margin: 8px 0 0;
        }

        .footer {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0 14px 14px;
        }

        .footer-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .footer-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          margin-left: auto;
        }

        .playback-btn .icon-stop {
          display: none;
        }

        .playback-btn:hover .icon-speaker {
          display: none;
        }

        .playback-btn:hover .icon-stop {
          display: block;
        }

        @keyframes mot-speaker-wave {
          0%,
          100% {
            opacity: 0.25;
          }

          50% {
            opacity: 1;
          }
        }

        .speaker-wave-1 {
          animation: mot-speaker-wave 1s ease-in-out infinite;
        }

        .speaker-wave-2 {
          animation: mot-speaker-wave 1s ease-in-out 0.35s infinite;
        }

        .icon-btn {
          appearance: none;
          border: 0;
          background: transparent;
          color: #64748b;
          padding: 6px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .icon-btn[hidden] {
          display: none;
        }

        .icon-btn:hover {
          background: rgba(15, 23, 42, 0.06);
          color: #0f172a;
        }

        .icon-btn.is-active {
          background: rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }

        .icon-btn svg {
          width: 16px;
          height: 16px;
          display: block;
        }

        .status {
          margin: 0;
          font-size: 12px;
          line-height: 1.4;
          color: #64748b;
        }

        .status[hidden] {
          display: none;
        }

        .status.error {
          color: #b91c1c;
        }

        @keyframes mot-transcript-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .allow {
          appearance: none;
          align-self: flex-start;
          border: 1px solid rgba(79, 70, 229, 0.25);
          background: #eef2ff;
          color: #3730a3;
          border-radius: 8px;
          padding: 8px 12px;
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }

        .allow:hover {
          background: #e0e7ff;
          border-color: rgba(79, 70, 229, 0.4);
        }
      </style>
      <div class="host">
        <div class="card" part="card" data-template-version="${TEMPLATE_VERSION}">
          <header class="header" aria-label="Drag live transcript panel">
            <div class="header-left">
              <span class="header-spinner" aria-hidden="true"></span>
              <span class="header-pause" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </span>
              <p class="title">Live transcript</p>
            </div>
            <div class="header-actions">
              <button class="header-icon close" type="button" aria-label="Close" title="Close">×</button>
            </div>
          </header>
          <div class="body">
            <section class="translation-section" hidden>
              <p class="translation-line translation-line-original">
                <span class="translation-label">Original</span>
                <span class="translation-original-value"></span>
              </p>
              <p class="translation-line translation-line-gloss">
                <span class="translation-label">Translation</span>
                <span class="translation-gloss-value"></span>
              </p>
              <hr class="translation-divider" />
            </section>
            <div
              class="transcript"
              contenteditable="false"
              role="textbox"
              aria-multiline="true"
              aria-label="Live transcript"
            ></div>
          </div>
          <div class="footer">
            <p class="status" role="status" aria-live="polite"></p>
            <button class="allow" type="button" hidden>Allow tab audio</button>
            <div class="footer-toolbar">
              <button
                class="icon-btn playback-btn"
                type="button"
                data-role="stop-playback"
                aria-label="Stop pronunciation"
                title="Stop pronunciation"
                hidden
              >
                <span class="icon-speaker">${SPEAKER_ICON_SVG}</span>
                <span class="icon-stop">${PLAYBACK_STOP_ICON_SVG}</span>
              </button>
              <div class="footer-toolbar-actions">
              <button
                class="icon-btn"
                type="button"
                data-role="primary-action"
                aria-label="Stop transcription"
                title="Stop transcription"
                hidden
              >
                ${STOP_ICON_SVG}
              </button>
              <button
                class="icon-btn"
                type="button"
                data-role="reset-transcript"
                aria-label="Reset transcript"
                title="Reset transcript"
                hidden
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
              <button
                class="icon-btn"
                type="button"
                data-role="edit-transcript"
                aria-label="Edit transcript"
                title="Edit transcript"
                hidden
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const card = shadow.querySelector(".card") as HTMLElement;
  const header = shadow.querySelector(".header") as HTMLElement;
  const headerSpinner = shadow.querySelector(".header-spinner") as HTMLElement;
  const headerPauseIcon = shadow.querySelector(".header-pause") as HTMLElement;
  const hostWrap = shadow.querySelector(".host") as HTMLElement;
  const bodyEl = shadow.querySelector(".body") as HTMLElement;
  const transcriptEl = shadow.querySelector(".transcript") as HTMLElement;
  const statusEl = shadow.querySelector(".status") as HTMLElement;
  const allowButton = shadow.querySelector(".allow") as HTMLButtonElement;
  const actionButton = shadow.querySelector(
    "[data-role='primary-action']",
  ) as HTMLButtonElement;
  const resetButton = shadow.querySelector(
    "[data-role='reset-transcript']",
  ) as HTMLButtonElement;
  const editButton = shadow.querySelector(
    "[data-role='edit-transcript']",
  ) as HTMLButtonElement;
  const playbackButton = shadow.querySelector(
    "[data-role='stop-playback']",
  ) as HTMLButtonElement;
  const translationSection = shadow.querySelector(
    ".translation-section",
  ) as HTMLElement;
  const translationOriginalValueEl = shadow.querySelector(
    ".translation-original-value",
  ) as HTMLElement;
  const translationGlossValueEl = shadow.querySelector(
    ".translation-gloss-value",
  ) as HTMLElement;
  const closeButton = shadow.querySelector(".close") as HTMLButtonElement;

  if (
    !card ||
    !header ||
    !headerSpinner ||
    !headerPauseIcon ||
    !hostWrap ||
    !bodyEl ||
    !transcriptEl ||
    !statusEl ||
    !allowButton ||
    !actionButton ||
    !resetButton ||
    !editButton ||
    !playbackButton ||
    !translationSection ||
    !translationOriginalValueEl ||
    !translationGlossValueEl ||
    !closeButton
  ) {
    throw new Error("Transcript overlay template is incomplete.");
  }

  if (needsTemplate) {
    bindDrag(hostWrap, card, header);
    bindTranscriptEditKeyboardIsolation(transcriptEl);
  }

  playbackButton.onclick = (event) => {
    event.stopPropagation();
    onStopPlayback?.();
  };

  actionButton.onclick = (event) => {
    event.stopPropagation();
    if (headerPrimaryMode === "resume") {
      onResume?.();
      return;
    }
    if (headerPrimaryMode === "stop") {
      onStop?.();
    }
  };

  resetButton.onclick = (event) => {
    event.stopPropagation();
    if (transcriptEditMode) {
      setTranscriptEditMode(
        { transcriptEl, editButton },
        false,
        { applyEdits: false },
      );
    }
    onReset?.();
  };

  editButton.onclick = (event) => {
    event.stopPropagation();
    setTranscriptEditMode(
      { transcriptEl, editButton },
      !transcriptEditMode,
      { applyEdits: true },
    );
  };

  closeButton.onpointerdown = (event) => {
    event.stopPropagation();
  };
  closeButton.onclick = (event) => {
    event.stopPropagation();
    onClose?.();
  };

  return {
    host: hostWrap,
    card,
    header,
    headerSpinner,
    headerPauseIcon,
    bodyEl,
    transcriptEl,
    statusEl,
    allowButton,
    stopButton: actionButton,
    resetButton,
    editButton,
    closeButton,
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
    playbackButton,
    shadow,
  };
}

function bindDrag(
  host: HTMLElement,
  card: HTMLElement,
  header: HTMLElement,
): void {
  let offsetX = 0;
  let offsetY = 0;

  header.onpointerdown = (event) => {
    if (event.button !== 0) {
      return;
    }

    if (
      (event.target as Element | null)?.closest(
        ".header-icon, [data-role='primary-action']",
      )
    ) {
      return;
    }

    const rect = host.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    header.setPointerCapture(event.pointerId);

    host.style.left = `${rect.left}px`;
    host.style.top = `${rect.top}px`;
    host.style.bottom = "auto";
    host.style.transform = "none";

    header.onpointermove = (moveEvent) => {
      host.style.left = `${moveEvent.clientX - offsetX}px`;
      host.style.top = `${moveEvent.clientY - offsetY}px`;
    };

    header.onpointerup = () => {
      header.onpointermove = null;
      header.onpointerup = null;
      header.releasePointerCapture(event.pointerId);
    };
  };
}

function transcriptHostFromElement(transcriptEl: HTMLElement): HTMLElement | null {
  const root = transcriptEl.getRootNode();
  if (root instanceof ShadowRoot) {
    return root.host as HTMLElement;
  }

  return null;
}

function syncTranscriptEditHostState(
  transcriptEl: HTMLElement,
  enabled: boolean,
): void {
  const host = transcriptHostFromElement(transcriptEl);
  if (!host) {
    return;
  }

  if (enabled) {
    host.dataset.transcriptEdit = "true";
  } else {
    delete host.dataset.transcriptEdit;
  }
}

function bindTranscriptEditKeyboardIsolation(transcriptEl: HTMLElement): void {
  const isolateKeyEvent = (event: KeyboardEvent): void => {
    if (!transcriptEditMode || event.key === "Escape") {
      return;
    }

    if (event.currentTarget !== transcriptEl) {
      return;
    }

    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  const onPaste = (event: ClipboardEvent): void => {
    if (!transcriptEditMode) {
      return;
    }

    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!text) {
      return;
    }

    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    selection.collapseToEnd();
  };

  transcriptEl.addEventListener("keydown", isolateKeyEvent, true);
  transcriptEl.addEventListener("keyup", isolateKeyEvent, true);
  transcriptEl.addEventListener("paste", onPaste);
}

function setHeaderActivityIndicator(
  headerSpinner: HTMLElement,
  headerPauseIcon: HTMLElement,
  mode: "transcribing" | "paused" | "none",
): void {
  headerSpinner.classList.toggle("is-visible", mode === "transcribing");
  headerPauseIcon.classList.toggle("is-visible", mode === "paused");
}

function setFooterStatus(
  statusEl: HTMLElement,
  message: string | null,
  options?: { error?: boolean },
): void {
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("error");
    return;
  }

  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle("error", options?.error ?? false);
}

function hideTranscriptTranslation(
  elements: Pick<
    TranscriptOverlayElements,
    "translationSection" | "translationOriginalValueEl" | "translationGlossValueEl"
  >,
): void {
  const {
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
  } = elements;

  translationSection.hidden = true;
  translationOriginalValueEl.textContent = "";
  translationGlossValueEl.textContent = "";
  translationGlossValueEl.classList.remove("is-loading");
}

export function setTranscriptWordTranslation(
  state: TranscriptWordTranslationState,
): void {
  if (!isTranscriptOverlayVisible()) {
    return;
  }

  const {
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
  } = ensureOverlay();

  if (!state.visible) {
    hideTranscriptTranslation({
      translationSection,
      translationOriginalValueEl,
      translationGlossValueEl,
    });
    return;
  }

  translationSection.hidden = false;
  translationOriginalValueEl.textContent = state.originalText;
  translationGlossValueEl.textContent = state.loading
    ? "Translating…"
    : state.translationText;
  translationGlossValueEl.classList.toggle("is-loading", state.loading === true);
}

export function highlightTranscriptWord(
  index: number | null,
  endIndex?: number | null,
): void {
  if (!isTranscriptOverlayVisible()) {
    return;
  }

  interactiveWordText.highlight(index, endIndex);
}

export function setTranscriptWordLoading(
  index: number | null,
  endIndex?: number | null,
): void {
  if (!isTranscriptOverlayVisible()) {
    return;
  }

  interactiveWordText.setLoading(index, endIndex);
}

export function setTranscriptPlaybackVisible(visible: boolean): void {
  if (!isTranscriptOverlayVisible()) {
    return;
  }

  const { playbackButton } = ensureOverlay();
  playbackButton.hidden = !visible;
}

export function setTranscriptReadStatus(message: string | null): void {
  if (!isTranscriptOverlayVisible()) {
    return;
  }

  const { statusEl } = ensureOverlay();
  setFooterStatus(statusEl, message);
}

function setPrimaryTranscriptionAction(
  primaryButton: HTMLButtonElement,
  mode: "stop" | "resume" | "hidden",
): void {
  headerPrimaryMode = mode;

  if (mode === "hidden") {
    primaryButton.hidden = true;
    return;
  }

  primaryButton.hidden = false;

  if (mode === "resume") {
    primaryButton.innerHTML = RESUME_ICON_SVG;
    primaryButton.title = "Resume transcription";
    primaryButton.setAttribute("aria-label", "Resume transcription");
    return;
  }

  primaryButton.innerHTML = STOP_ICON_SVG;
  primaryButton.title = "Stop transcription";
  primaryButton.setAttribute("aria-label", "Stop transcription");
}

function resetTranscriptLayout(transcriptEl: HTMLElement): void {
  transcriptRowCount = 1;
  transcriptEl.classList.remove("is-expanded");
  transcriptEl.scrollTop = 0;
}

function setTranscriptToolbar(
  elements: {
    transcriptEl: HTMLElement;
    resetButton: HTMLButtonElement;
    editButton: HTMLButtonElement;
  },
  options: { reset: boolean; edit: boolean },
): void {
  const { transcriptEl, resetButton, editButton } = elements;

  if (
    overlayActivity === "streaming" &&
    !options.edit &&
    transcriptEditMode
  ) {
    setTranscriptEditMode({ transcriptEl, editButton }, false, {
      applyEdits: true,
    });
  }

  resetButton.hidden = !options.reset;
  editButton.hidden = !options.edit;
}

function setTranscriptEditMode(
  elements: {
    transcriptEl: HTMLElement;
    editButton: HTMLButtonElement;
  },
  enabled: boolean,
  options: { applyEdits: boolean },
): void {
  const { transcriptEl, editButton } = elements;

  if (enabled && transcriptEditMode) {
    return;
  }

  const wasEditing = transcriptEditMode;
  transcriptEditMode = enabled;
  syncTranscriptEditHostState(transcriptEl, enabled);
  setTranscriptContentEditable(transcriptEl, enabled);
  transcriptEl.classList.toggle("is-editing", enabled);
  transcriptEl.classList.toggle(
    "is-read-mode",
    !enabled && overlayActivity === "paused" && onWordSelect !== null,
  );
  editButton.classList.toggle("is-active", enabled);
  editButton.innerHTML = enabled ? CHECK_ICON_SVG : EDIT_ICON_SVG;
  editButton.title = enabled ? "Done editing" : "Edit transcript";
  editButton.setAttribute(
    "aria-label",
    enabled ? "Done editing" : "Edit transcript",
  );

  if (!enabled && wasEditing && options.applyEdits) {
    onTranscriptEdited?.(getTranscriptText(transcriptEl));
  }

  if (enabled) {
    onStopPlayback?.();
    const overlay = ensureOverlay();
    hideTranscriptTranslation(overlay);
    interactiveWordText.highlight(null);
    interactiveWordText.setLoading(null);
    overlay.playbackButton.hidden = true;

    const plainText = getTranscriptText(transcriptEl);
    interactiveWordText.setPlainText(transcriptEl, plainText);

    if (transcriptEl.classList.contains("is-placeholder")) {
      setTranscriptText(transcriptEl, "");
      transcriptEl.classList.remove("is-placeholder");
    }

    requestAnimationFrame(() => {
      applyTranscriptLayout(transcriptEl);
      scrollTranscriptToEnd(transcriptEl);
      focusTranscriptEnd(transcriptEl);
      scrollTranscriptToEnd(transcriptEl);
    });
    return;
  }

  if (!enabled) {
    transcriptEl.blur();
    transcriptHostFromElement(transcriptEl)?.blur();

    if (
      wasEditing &&
      !options.applyEdits &&
      overlayActivity === "paused" &&
      onWordSelect
    ) {
      const shadow = transcriptEl.getRootNode();
      if (shadow instanceof ShadowRoot) {
        const text = getTranscriptText(transcriptEl);
        interactiveWordText.renderWithWordSpans(
          transcriptEl,
          text,
          shadow,
          onWordSelect,
        );
      }
    }
  }
}

function scrollTranscriptToEnd(transcriptEl: HTMLElement): void {
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

function transcriptOverflows(transcriptEl: HTMLElement): boolean {
  return transcriptEl.scrollHeight > transcriptEl.clientHeight + 1;
}

/** Expand once to two rows when text wraps; then scroll within the fixed viewport. */
function applyTranscriptLayout(transcriptEl: HTMLElement): void {
  if (
    transcriptRowCount < MAX_VISIBLE_LINES &&
    transcriptOverflows(transcriptEl)
  ) {
    transcriptRowCount = MAX_VISIBLE_LINES;
    transcriptEl.classList.add("is-expanded");

    requestAnimationFrame(() => {
      if (transcriptOverflows(transcriptEl)) {
        scrollTranscriptToEnd(transcriptEl);
      }
    });
    return;
  }

  if (
    transcriptEl.classList.contains("is-expanded") &&
    transcriptOverflows(transcriptEl)
  ) {
    scrollTranscriptToEnd(transcriptEl);
  }
}

function renderTranscriptText(
  transcriptEl: HTMLElement,
  lines: string[],
  partial: string,
  shadow: ShadowRoot,
): void {
  if (transcriptEditMode) {
    return;
  }

  const isReadMode = overlayActivity === "paused" && onWordSelect !== null;
  transcriptEl.classList.toggle("is-read-mode", isReadMode);
  transcriptEl.classList.toggle("is-editing", false);

  const entries = [...lines];
  if (partial) {
    entries.push(partial);
  }

  if (entries.length === 0) {
    resetTranscriptLayout(transcriptEl);
    interactiveWordText.setPlainText(transcriptEl, WAITING_PLACEHOLDER);
    transcriptEl.classList.add("is-placeholder");
    return;
  }

  transcriptEl.classList.remove("is-placeholder");
  const visible = entries.slice(-MAX_VISIBLE_LINES);
  const text = visible.join("\n");

  if (isReadMode && onWordSelect) {
    interactiveWordText.renderWithWordSpans(
      transcriptEl,
      text,
      shadow,
      onWordSelect,
    );
  } else {
    interactiveWordText.setPlainText(transcriptEl, text);
  }

  requestAnimationFrame(() => {
    applyTranscriptLayout(transcriptEl);
  });
}

function headerIndicatorForActivity(): "transcribing" | "paused" | "none" {
  if (overlayActivity === "streaming") {
    return "transcribing";
  }

  if (overlayActivity === "paused") {
    return "paused";
  }

  return "none";
}

let onAllowCapture: (() => void) | null = null;

export function showTranscriptOverlay(
  state: TranscriptOverlayState,
  handlers: {
    onStop: () => void;
    onResume?: () => void;
    onClose: () => void;
    onAllowCapture?: () => void;
    onReset?: () => void;
    onTranscriptEdited?: (text: string) => void;
    onWordSelect?: (startIndex: number, endIndex: number) => void;
    onStopPlayback?: () => void;
  },
): void {
  onStop = handlers.onStop;
  onResume = handlers.onResume ?? null;
  onClose = handlers.onClose;
  onAllowCapture = handlers.onAllowCapture ?? null;
  onReset = handlers.onReset ?? null;
  onTranscriptEdited = handlers.onTranscriptEdited ?? null;
  onWordSelect = handlers.onWordSelect ?? null;
  onStopPlayback = handlers.onStopPlayback ?? null;

  const overlay = ensureOverlay();
  const pendingEditText = transcriptEditMode
    ? getTranscriptText(overlay.transcriptEl)
    : null;

  streamingUiReady = false;

  if (transcriptEditMode) {
    setTranscriptEditMode(
      { transcriptEl: overlay.transcriptEl, editButton: overlay.editButton },
      false,
      { applyEdits: false },
    );
  }

  const {
    host,
    transcriptEl,
    statusEl,
    headerSpinner,
    headerPauseIcon,
    allowButton,
    stopButton,
    resetButton,
    editButton,
    shadow,
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
    playbackButton,
  } = overlay;

  host.style.display = "block";
  allowButton.hidden = true;
  allowButton.onclick = () => onAllowCapture?.();
  hideTranscriptTranslation({
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
  });
  playbackButton.hidden = true;

  const commitPendingEdit = (): void => {
    if (pendingEditText && onTranscriptEdited) {
      onTranscriptEdited(pendingEditText);
    }
  };

  if (state.kind === "loading") {
    overlayActivity = "idle";
    renderTranscriptText(transcriptEl, [], "", shadow);
    setHeaderActivityIndicator(headerSpinner, headerPauseIcon, "none");
    setFooterStatus(statusEl, state.detail);
    setPrimaryTranscriptionAction(stopButton, "hidden");
    setTranscriptToolbar(
      { transcriptEl, resetButton, editButton },
      { reset: false, edit: false },
    );
    commitPendingEdit();
    return;
  }

  if (state.kind === "needs-capture") {
    overlayActivity = "idle";
    renderTranscriptText(transcriptEl, [], "", shadow);
    setHeaderActivityIndicator(headerSpinner, headerPauseIcon, "none");
    setFooterStatus(
      statusEl,
      state.message ??
      "Tab audio capture needs your confirmation on this page.",
    );
    allowButton.hidden = !onAllowCapture;
    setPrimaryTranscriptionAction(stopButton, "hidden");
    setTranscriptToolbar(
      { transcriptEl, resetButton, editButton },
      { reset: false, edit: false },
    );
    commitPendingEdit();
    return;
  }

  if (state.kind === "error") {
    overlayActivity = "idle";
    renderTranscriptText(transcriptEl, [], "", shadow);
    setHeaderActivityIndicator(headerSpinner, headerPauseIcon, "none");
    setFooterStatus(statusEl, state.message, { error: true });
    setPrimaryTranscriptionAction(stopButton, "hidden");
    setTranscriptToolbar(
      { transcriptEl, resetButton, editButton },
      { reset: false, edit: false },
    );
    commitPendingEdit();
    return;
  }

  if (state.kind === "paused") {
    overlayActivity = "paused";
    renderTranscriptText(transcriptEl, state.lines, "", shadow);
    setHeaderActivityIndicator(headerSpinner, headerPauseIcon, "paused");
    setFooterStatus(statusEl, null);
    setPrimaryTranscriptionAction(stopButton, "resume");
    setTranscriptToolbar(
      { transcriptEl, resetButton, editButton },
      { reset: true, edit: true },
    );
    commitPendingEdit();
    return;
  }

  overlayActivity = "streaming";
  renderTranscriptText(transcriptEl, state.lines, state.partial, shadow);
  setHeaderActivityIndicator(headerSpinner, headerPauseIcon, "transcribing");
  setFooterStatus(statusEl, null);
  setPrimaryTranscriptionAction(stopButton, "stop");
  setTranscriptToolbar(
    { transcriptEl, resetButton, editButton },
    { reset: true, edit: false },
  );
  commitPendingEdit();
}

export function refreshPausedTranscriptOverlay(
  lines: string[],
  partial: string,
): void {
  overlayActivity = "paused";

  const overlay = ensureOverlay();
  const {
    transcriptEl,
    statusEl,
    headerSpinner,
    headerPauseIcon,
    stopButton,
    resetButton,
    editButton,
    shadow,
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
  } = overlay;

  hideTranscriptTranslation({
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
  });

  setHeaderActivityIndicator(headerSpinner, headerPauseIcon, "paused");
  setFooterStatus(statusEl, null);
  setPrimaryTranscriptionAction(stopButton, "resume");
  setTranscriptToolbar(
    { transcriptEl, resetButton, editButton },
    { reset: true, edit: true },
  );

  if (!transcriptEditMode) {
    renderTranscriptText(transcriptEl, lines, partial, shadow);
  }
}

export function updateTranscriptLoadingProgress(
  detail: string,
  _percent?: number,
): void {
  const { statusEl, headerSpinner, headerPauseIcon } = ensureOverlay();
  setHeaderActivityIndicator(
    headerSpinner,
    headerPauseIcon,
    headerIndicatorForActivity(),
  );
  setFooterStatus(statusEl, detail);
}

export function updateTranscriptOverlay(lines: string[], partial: string): void {
  overlayActivity = "streaming";

  const overlay = ensureOverlay();
  const {
    transcriptEl,
    statusEl,
    headerSpinner,
    headerPauseIcon,
    stopButton,
    resetButton,
    editButton,
    shadow,
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
  } = overlay;

  hideTranscriptTranslation({
    translationSection,
    translationOriginalValueEl,
    translationGlossValueEl,
  });

  setHeaderActivityIndicator(headerSpinner, headerPauseIcon, "transcribing");
  setFooterStatus(statusEl, null);
  setTranscriptToolbar(
    { transcriptEl, resetButton, editButton },
    { reset: true, edit: false },
  );

  if (!transcriptEditMode) {
    renderTranscriptText(transcriptEl, lines, partial, shadow);
  }

  if (!streamingUiReady) {
    setPrimaryTranscriptionAction(stopButton, "stop");
    streamingUiReady = true;
  }
}

export function isTranscriptOverlayVisible(): boolean {
  return document.getElementById(OVERLAY_ID) !== null;
}

export function hideTranscriptOverlay(): void {
  const host = document.getElementById(OVERLAY_ID);
  if (host) {
    delete host.dataset.transcriptEdit;
  }

  host?.remove();
  onStop = null;
  onResume = null;
  onClose = null;
  onAllowCapture = null;
  onReset = null;
  onTranscriptEdited = null;
  onWordSelect = null;
  onStopPlayback = null;
  interactiveWordText.clearWordSpans();
  transcriptRowCount = 1;
  streamingUiReady = false;
  transcriptEditMode = false;
  overlayActivity = "idle";
  headerPrimaryMode = "hidden";
}

export function bindTranscriptDismissals(onClose: () => void): void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !isTranscriptOverlayVisible()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    onClose();
  };

  window.addEventListener("keydown", handleKeyDown, true);
}
