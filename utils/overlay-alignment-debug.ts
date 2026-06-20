import { estimateAlignmentFromAudio } from "./alignment-from-audio";
import { base64ToArrayBuffer } from "./audio-encoding";
import { getOverlayAlignmentDebugElements } from "./overlay";
import { ALIGNMENT_DEBUG_UI_ENABLED } from "./supertonic/constants";
import {
  buildAlignment,
  DEFAULT_SIGNAL_ALIGNMENT_OPTIONS,
  wordAlignmentFromAudio,
  type SignalAlignmentOptions,
} from "./supertonic/alignment";
import { readWavSamples } from "./supertonic/wav";
import type { TtsAlignment } from "./tts-types";

const DEBUG_STORAGE_KEY = "mot-alignment-debug";

let debugTuning: SignalAlignmentOptions = { ...DEFAULT_SIGNAL_ALIGNMENT_OPTIONS };
let controlsBound = false;
let toggleBound = false;
let panelOpen = false;

export type AlignmentDebugHost = {
  getAlignment: () => TtsAlignment | null;
  getActiveWordIndex: () => number | null;
  getReportedTimeS: () => number;
  getEstimatedTimeS: () => number;
  getLatencyCompensationS: () => number;
  getDurationS: () => number;
  hasClip: () => boolean;
  onRealign: () => void;
};

function formatSeconds(value: number): string {
  return `${value.toFixed(3)}s`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function readPanelOpenFromStorage(): boolean {
  if (!ALIGNMENT_DEBUG_UI_ENABLED) {
    return false;
  }

  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePanelOpenToStorage(open: boolean): void {
  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, open ? "1" : "0");
  } catch {
    // Ignore private browsing storage errors.
  }
}

function createRangeControl(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  format: (value: number) => string,
  onChange: (value: number) => void,
): HTMLElement {
  const row = document.createElement("label");
  row.className = "alignment-debug-control";

  const title = document.createElement("span");
  title.className = "alignment-debug-control-label";
  title.textContent = label;

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);

  const valueEl = document.createElement("span");
  valueEl.className = "alignment-debug-control-value";
  valueEl.textContent = format(value);

  input.addEventListener("input", () => {
    const next = Number(input.value);
    valueEl.textContent = format(next);
    onChange(next);
  });

  row.append(title, input, valueEl);
  return row;
}

function renderControls(
  controlsEl: HTMLElement,
  host: AlignmentDebugHost,
): void {
  controlsEl.replaceChildren();

  controlsEl.append(
    createRangeControl(
      "Energy threshold",
      0.05,
      0.35,
      0.01,
      debugTuning.energyThreshold ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.energyThreshold!,
      (value) => value.toFixed(2),
      (value) => {
        debugTuning = { ...debugTuning, energyThreshold: value };
        host.onRealign();
        refreshList(host);
      },
    ),
    createRangeControl(
      "Smooth (ms)",
      10,
      60,
      5,
      debugTuning.smoothMs ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.smoothMs!,
      (value) => `${Math.round(value)}ms`,
      (value) => {
        debugTuning = { ...debugTuning, smoothMs: value };
        host.onRealign();
        refreshList(host);
      },
    ),
    createRangeControl(
      "Min word (ms)",
      20,
      150,
      5,
      debugTuning.minWordMs ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.minWordMs!,
      (value) => `${Math.round(value)}ms`,
      (value) => {
        debugTuning = { ...debugTuning, minWordMs: value };
        host.onRealign();
        refreshList(host);
      },
    ),
    createRangeControl(
      "Valley search",
      0.2,
      0.7,
      0.05,
      debugTuning.valleySearchRatio ?? DEFAULT_SIGNAL_ALIGNMENT_OPTIONS.valleySearchRatio!,
      (value) => value.toFixed(2),
      (value) => {
        debugTuning = { ...debugTuning, valleySearchRatio: value };
        host.onRealign();
        refreshList(host);
      },
    ),
  );
}

function renderList(
  listEl: HTMLElement,
  host: AlignmentDebugHost,
): void {
  listEl.replaceChildren();

  const caption = document.createElement("p");
  caption.className = "alignment-debug-caption";
  caption.textContent =
    "Signal-based timings from audio energy valleys (not model output).";
  listEl.appendChild(caption);

  const alignment = host.getAlignment();
  const activeWordIndex = host.getActiveWordIndex();

  if (!alignment?.words.length) {
    const empty = document.createElement("p");
    empty.className = "alignment-debug-empty";
    empty.textContent = "No alignment data for this clip.";
    listEl.appendChild(empty);
    return;
  }

  for (const word of alignment.words) {
    const row = document.createElement("div");
    row.className = "alignment-debug-row";
    row.dataset.wordIndex = String(word.index);
    if (activeWordIndex === word.index) {
      row.classList.add("is-active");
    }

    const meta = document.createElement("div");
    meta.className = "alignment-debug-meta";
    meta.innerHTML = `
      <span class="alignment-debug-index">#${word.index + 1}</span>
      <span class="alignment-debug-word">${escapeHtml(word.text)}</span>
      <span class="alignment-debug-time">${formatSeconds(word.start)} → ${formatSeconds(word.end)}</span>
    `;

    row.append(meta);
    listEl.appendChild(row);
  }
}

function refreshList(host: AlignmentDebugHost): void {
  const elements = getOverlayAlignmentDebugElements();
  if (!elements || elements.panel.hidden) {
    return;
  }

  renderList(elements.list, host);
}

function setPanelVisible(
  panelEl: HTMLElement,
  toggleButton: HTMLButtonElement,
  visible: boolean,
): void {
  panelEl.hidden = !visible;
  toggleButton.textContent = visible ? "Hide sync debug" : "Sync debug";
  toggleButton.setAttribute("aria-expanded", visible ? "true" : "false");
}

export function resetAlignmentDebugBindings(): void {
  controlsBound = false;
  toggleBound = false;
  panelOpen = readPanelOpenFromStorage();
}

export function syncAlignmentDebug(host: AlignmentDebugHost): void {
  if (!ALIGNMENT_DEBUG_UI_ENABLED) {
    return;
  }

  const elements = getOverlayAlignmentDebugElements();
  if (!elements) {
    return;
  }

  const alignment = host.getAlignment();
  elements.toggle.hidden = !host.hasClip() || !alignment?.words.length;

  if (elements.toggle.hidden) {
    elements.panel.hidden = true;
    return;
  }

  if (!controlsBound) {
    controlsBound = true;
    renderControls(elements.controls, host);
  }

  if (!toggleBound) {
    toggleBound = true;
    elements.toggle.addEventListener("click", () => {
      panelOpen = !panelOpen;
      writePanelOpenToStorage(panelOpen);
      setPanelVisible(elements.panel, elements.toggle, panelOpen);
      if (panelOpen) {
        renderList(elements.list, host);
      }
    });
  }

  setPanelVisible(elements.panel, elements.toggle, panelOpen);

  if (panelOpen) {
    renderList(elements.list, host);
  }
}

export function updateAlignmentDebugDuringPlayback(host: AlignmentDebugHost): void {
  if (!ALIGNMENT_DEBUG_UI_ENABLED) {
    return;
  }

  const elements = getOverlayAlignmentDebugElements();
  if (!elements || elements.panel.hidden) {
    return;
  }

  const activeWordIndex = host.getActiveWordIndex();
  elements.clock.textContent =
    `Reported ${formatSeconds(host.getReportedTimeS())} · ` +
    `Estimated ${formatSeconds(host.getEstimatedTimeS())} · ` +
    `Latency ${formatSeconds(host.getLatencyCompensationS())} · ` +
    `Duration ${formatSeconds(host.getDurationS())} · ` +
    `Highlight ${activeWordIndex === null ? "—" : `#${activeWordIndex + 1}`}`;

  for (const row of elements.list.querySelectorAll(".alignment-debug-row")) {
    const wordIndex = Number((row as HTMLElement).dataset.wordIndex);
    row.classList.toggle(
      "is-active",
      activeWordIndex !== null && wordIndex === activeWordIndex,
    );
  }
}

export function estimateAlignmentWithDebugTuning(
  audioBase64: string,
  displayText: string,
): TtsAlignment | null {
  if (!ALIGNMENT_DEBUG_UI_ENABLED) {
    return estimateAlignmentFromAudio(audioBase64, displayText);
  }

  if (!audioBase64.trim() || !displayText.trim()) {
    return null;
  }

  try {
    const { samples, sampleRate } = readWavSamples(base64ToArrayBuffer(audioBase64));
    const totalDurationS = samples.length / sampleRate;
    const { words } = wordAlignmentFromAudio(
      samples,
      sampleRate,
      displayText,
      totalDurationS,
      0,
      debugTuning,
    );
    return buildAlignment(words);
  } catch {
    return null;
  }
}

panelOpen = readPanelOpenFromStorage();
