import { estimateAlignmentFromAudio } from "./alignment-from-audio";
import { base64ToArrayBuffer } from "./audio-encoding";
import { ALIGNMENT_DEBUG_UI_ENABLED } from "./supertonic/constants";
import {
  buildAlignment,
  DEFAULT_SIGNAL_ALIGNMENT_OPTIONS,
  wordAlignmentFromAudio,
  type SignalAlignmentOptions,
} from "./supertonic/alignment";
import { readWavSamples } from "./supertonic/wav";
import type { TtsAlignment } from "./tts-types";
import { getAlignmentDebugTuning } from "../features/tts-overlay/alignment-debug-state";
import { ttsOverlay } from "../features/tts-overlay/tts-overlay-controller";

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

export function resetAlignmentDebugBindings(): void {
  ttsOverlay.setAlignmentDebugHost(null);
}

export function syncAlignmentDebug(host: AlignmentDebugHost): void {
  if (!ALIGNMENT_DEBUG_UI_ENABLED) {
    return;
  }

  ttsOverlay.setAlignmentDebugHost(host);
  ttsOverlay.syncAlignmentDebug();
}

export function updateAlignmentDebugDuringPlayback(host: AlignmentDebugHost): void {
  if (!ALIGNMENT_DEBUG_UI_ENABLED) {
    return;
  }

  ttsOverlay.setAlignmentDebugHost(host);
  ttsOverlay.updateAlignmentDebugDuringPlayback();
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

  const debugTuning: SignalAlignmentOptions = getAlignmentDebugTuning();

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
