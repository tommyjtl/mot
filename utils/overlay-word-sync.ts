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
  const words = alignment.words;
  if (words.length === 0) {
    return null;
  }

  const firstWord = words[0]!;
  const lastWord = words.at(-1)!;

  if (currentTime < firstWord.start) {
    return 0;
  }

  if (currentTime >= lastWord.end) {
    return words.length - 1;
  }

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const nextWord = words[index + 1];

    if (currentTime >= word.start && currentTime < word.end) {
      return index;
    }

    if (
      nextWord &&
      currentTime >= word.end &&
      currentTime < nextWord.start
    ) {
      return index;
    }
  }

  return words.length - 1;
}

export function overlayWordIndexAtTime(
  text: string,
  currentTime: number,
  duration: number,
  alignment?: TtsAlignment | null,
): number | null {
  if (alignment?.words.length) {
    return alignedWordIndex(alignment, currentTime);
  }

  return proportionalWordIndex(text, currentTime, duration);
}
