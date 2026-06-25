import { ALIGNMENT_DEBUG_UI_ENABLED } from "../../utils/supertonic/constants";
import {
  DEFAULT_SIGNAL_ALIGNMENT_OPTIONS,
  type SignalAlignmentOptions,
} from "../../utils/supertonic/alignment";
import type { AlignmentDebugHost } from "../../utils/overlay-alignment-debug";

const DEBUG_STORAGE_KEY = "mot-alignment-debug";

let debugTuning: SignalAlignmentOptions = {
  ...DEFAULT_SIGNAL_ALIGNMENT_OPTIONS,
};
let panelOpen = readPanelOpenFromStorage();

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

export function getAlignmentDebugTuning(): SignalAlignmentOptions {
  return debugTuning;
}

export function resetAlignmentDebugPanelState(): void {
  panelOpen = readPanelOpenFromStorage();
}

export function useAlignmentDebugPanelState(): {
  open: boolean;
  toggle: () => void;
} {
  return {
    open: panelOpen,
    toggle: () => {
      panelOpen = !panelOpen;
      writePanelOpenToStorage(panelOpen);
    },
  };
}

export function formatAlignmentSeconds(value: number): string {
  return `${value.toFixed(3)}s`;
}

export function createRangeControlProps(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  format: (value: number) => string,
  onChange: (value: number) => void,
) {
  return { label, min, max, step, value, format, onChange };
}

export function updateDebugTuning(
  patch: Partial<SignalAlignmentOptions>,
  host: AlignmentDebugHost,
): void {
  debugTuning = { ...debugTuning, ...patch };
  host.onRealign();
}

export function isAlignmentDebugPanelOpen(): boolean {
  return panelOpen;
}

export function setAlignmentDebugPanelOpen(open: boolean): void {
  panelOpen = open;
  writePanelOpenToStorage(open);
}

export function toggleAlignmentDebugPanel(): void {
  setAlignmentDebugPanelOpen(!panelOpen);
}
