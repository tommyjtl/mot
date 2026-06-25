import { tokenizeWords } from "../overlay-phrase";
import { normalizeVocabKey } from "./normalize";

export type TextRange = {
  start: number;
  end: number;
};

export type WordIndexRange = {
  start: number;
  end: number;
};

function normalizeToken(text: string): string {
  return normalizeVocabKey(text);
}

/** Find saved word/phrase spans in a context sentence using token alignment. */
export function findContextTermRanges(
  sentence: string,
  original: string,
): TextRange[] {
  const normalizedSentence = sentence.normalize("NFC");
  const term = original.trim().normalize("NFC");
  if (!term) {
    return [];
  }

  const sentenceTokens = tokenizeWords(normalizedSentence);
  const termTokens = tokenizeWords(term);
  if (termTokens.length === 0 || sentenceTokens.length < termTokens.length) {
    return [];
  }

  const normalizedTermTokens = termTokens.map((token) =>
    normalizeToken(token.text),
  );
  const ranges: TextRange[] = [];

  for (
    let index = 0;
    index <= sentenceTokens.length - termTokens.length;
    index += 1
  ) {
    let matched = true;

    for (let offset = 0; offset < termTokens.length; offset += 1) {
      const sentenceToken = sentenceTokens[index + offset];
      if (
        !sentenceToken ||
        normalizeToken(sentenceToken.text) !== normalizedTermTokens[offset]
      ) {
        matched = false;
        break;
      }
    }

    if (!matched) {
      continue;
    }

    const first = sentenceTokens[index];
    const last = sentenceTokens[index + termTokens.length - 1];
    if (!first || !last) {
      continue;
    }

    ranges.push({ start: first.start, end: last.end });
  }

  return mergeRanges(ranges);
}

/** Map saved-term character spans to word indices for InteractiveWordText. */
export function findContextTermWordRanges(
  sentence: string,
  original: string,
): WordIndexRange[] {
  const normalizedSentence = sentence.normalize("NFC");
  const charRanges = findContextTermRanges(normalizedSentence, original);
  if (charRanges.length === 0) {
    return [];
  }

  const words = tokenizeWords(normalizedSentence);
  const wordRanges: WordIndexRange[] = [];

  for (const range of charRanges) {
    let startIdx: number | null = null;
    let endIdx: number | null = null;

    for (let index = 0; index < words.length; index += 1) {
      const word = words[index];
      if (!word) {
        continue;
      }
      if (word.end <= range.start) {
        continue;
      }
      if (word.start >= range.end) {
        break;
      }
      if (startIdx === null) {
        startIdx = index;
      }
      endIdx = index;
    }

    if (startIdx !== null && endIdx !== null) {
      wordRanges.push({ start: startIdx, end: endIdx });
    }
  }

  return wordRanges;
}

function mergeRanges(ranges: TextRange[]): TextRange[] {
  if (ranges.length <= 1) {
    return ranges;
  }

  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged: TextRange[] = [sorted[0]!];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    const previous = merged[merged.length - 1]!;

    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
      continue;
    }

    merged.push(current);
  }

  return merged;
}

export type HighlightSegment =
  | { kind: "text"; value: string }
  | { kind: "term"; value: string };

export function splitTextByRanges(
  text: string,
  ranges: TextRange[],
): HighlightSegment[] {
  if (ranges.length === 0) {
    return [{ kind: "text", value: text }];
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, range.start) });
    }

    if (range.end > range.start) {
      segments.push({ kind: "term", value: text.slice(range.start, range.end) });
    }

    cursor = Math.max(cursor, range.end);
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }

  return segments;
}

/** Highlight segments for a saved term in context. Normalizes to NFC once. */
export function getContextHighlightSegments(
  sentence: string,
  original: string,
): HighlightSegment[] {
  const normalizedSentence = sentence.normalize("NFC");
  const ranges = findContextTermRanges(normalizedSentence, original);
  return splitTextByRanges(normalizedSentence, ranges);
}
