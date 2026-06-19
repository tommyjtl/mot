/** Overlay-only word highlight synced to audio playback time. */

import type { TtsAlignment } from "./tts-types";

function proportionalWordIndex(
  text: string,
  currentTime: number,
  duration: number,
): number | null {
  const wordCount = (text.match(/\S+/g) ?? []).length;
  if (wordCount === 0 || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  const progress = Math.min(Math.max(currentTime / duration, 0), 1);
  if (progress >= 1) {
    return null;
  }

  return Math.min(Math.floor(progress * wordCount), wordCount - 1);
}

function alignedWordIndex(
  alignment: TtsAlignment,
  currentTime: number,
): number | null {
  for (let index = 0; index < alignment.words.length; index += 1) {
    const word = alignment.words[index]!;
    if (currentTime >= word.start && currentTime < word.end) {
      return index;
    }
  }

  const lastWord = alignment.words.at(-1);
  if (lastWord && currentTime >= lastWord.end) {
    return null;
  }

  return null;
}

export function overlayWordIndexAtTime(
  text: string,
  currentTime: number,
  duration: number,
  alignment?: TtsAlignment | null,
): number | null {
  if (alignment?.words.length) {
    const aligned = alignedWordIndex(alignment, currentTime);
    if (aligned !== null) {
      return aligned;
    }
  }

  return proportionalWordIndex(text, currentTime, duration);
}
