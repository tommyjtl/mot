import { expandIndicesToWordBoundaries } from "./selection";

export type WordToken = {
  start: number;
  end: number;
  text: string;
};

export function tokenizeWords(source: string): WordToken[] {
  const tokens: WordToken[] = [];
  const regex = /(\S+|\s+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const part = match[0];
    if (/^\s+$/.test(part)) {
      continue;
    }

    tokens.push({
      start: match.index,
      end: match.index + part.length,
      text: part,
    });
  }

  return tokens;
}

/** Slice source text for a word index range, expanding partial edges to whole words. */
export function phraseFromWordRange(
  source: string,
  startWordIndex: number,
  endWordIndex: number,
): string {
  const words = tokenizeWords(source);
  if (words.length === 0) {
    return "";
  }

  const start = Math.max(0, Math.min(startWordIndex, endWordIndex));
  const end = Math.min(words.length - 1, Math.max(startWordIndex, endWordIndex));
  const first = words[start];
  const last = words[end];

  if (!first || !last) {
    return "";
  }

  const expanded = expandIndicesToWordBoundaries(source, first.start, last.end);
  return source.slice(expanded.start, expanded.end);
}
