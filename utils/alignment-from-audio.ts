import { base64ToArrayBuffer } from "./audio-encoding";
import {
  buildAlignment,
  DEFAULT_SIGNAL_ALIGNMENT_OPTIONS,
  wordAlignmentFromAudio,
} from "./supertonic/alignment";
import { readWavSamples } from "./supertonic/wav";
import type { TtsAlignment } from "./tts-types";

export function estimateAlignmentFromAudio(
  audioBase64: string,
  displayText: string,
): TtsAlignment | null {
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
      DEFAULT_SIGNAL_ALIGNMENT_OPTIONS,
    );
    return buildAlignment(words);
  } catch {
    return null;
  }
}
