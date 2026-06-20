import type { TtsAlignment, WordTiming } from "../tts-types";

export {
  DEFAULT_SIGNAL_ALIGNMENT_OPTIONS,
  wordAlignmentFromAudio,
  type SignalAlignmentOptions,
} from "./signal-alignment";

const LANG_TAG_RE = /^<([a-z]{2}|na)>(.*)<\/\1>$/s;

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

export function buildAlignment(words: WordTiming[]): TtsAlignment {
  return { words };
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
