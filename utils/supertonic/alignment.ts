import type { TtsAlignment, WordTiming } from "../tts-types";

const LANG_TAG_RE = /^<([a-z]{2}|na)>(.*)<\/\1>$/s;
const WORD_RE = /\S+/g;

export function extractSpeakableText(preprocessed: string): {
  inner: string;
  start: number;
  end: number;
} {
  const match = LANG_TAG_RE.exec(preprocessed);
  if (!match) {
    return { inner: preprocessed, start: 0, end: preprocessed.length };
  }

  const inner = match[2] ?? preprocessed;
  const start = preprocessed.indexOf(inner);
  if (start < 0) {
    return { inner: preprocessed, start: 0, end: preprocessed.length };
  }

  return { inner, start, end: start + inner.length };
}

function charDurationsForText(
  preprocessed: string,
  charDurations: number[],
): number[] {
  if (charDurations.length >= preprocessed.length) {
    return charDurations.slice(0, preprocessed.length);
  }

  return [
    ...charDurations,
    ...new Array(preprocessed.length - charDurations.length).fill(0),
  ];
}

export function wordAlignmentFromPreprocessed(
  preprocessed: string,
  charDurations: number[],
  timeOffset = 0,
  wordIndexStart = 0,
): { words: WordTiming[]; timelineEnd: number } {
  const durs = charDurationsForText(preprocessed, charDurations);
  const { inner, start, end } = extractSpeakableText(preprocessed);

  const leadingTime = start > 0 ? sum(durs.slice(0, start)) : 0;
  const innerDurs = durs.slice(start, end);

  const words: WordTiming[] = [];
  let cursor = timeOffset + leadingTime;

  for (const match of inner.matchAll(WORD_RE)) {
    const wordStart = cursor;
    for (let index = match.index ?? 0; index < (match.index ?? 0) + match[0].length; index += 1) {
      cursor += innerDurs[index] ?? 0;
    }

    words.push({
      index: wordIndexStart + words.length,
      text: match[0],
      start: wordStart,
      end: cursor,
    });
  }

  const trailingTime = end < durs.length ? sum(durs.slice(end)) : 0;
  return { words, timelineEnd: cursor + trailingTime };
}

export function scaleWordTimings(
  words: WordTiming[],
  chunkStart: number,
  predictedDuration: number,
  actualDuration: number,
): WordTiming[] {
  if (words.length === 0 || predictedDuration <= 0 || actualDuration <= 0) {
    return words;
  }

  const scale = actualDuration / predictedDuration;
  return words.map((word) => ({
    ...word,
    start: chunkStart + (word.start - chunkStart) * scale,
    end: chunkStart + (word.end - chunkStart) * scale,
  }));
}

export function buildAlignment(words: WordTiming[]): TtsAlignment {
  return { words };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function joinDisplayText(parts: string[]): string {
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0] ?? "";
  }
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}
