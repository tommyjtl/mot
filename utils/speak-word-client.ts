import type { Message } from "./messages";

export type SpeakWordParams = {
  word: string;
  requestId: number;
  wordIndex?: number;
  endWordIndex?: number;
};

/** Ask the background worker to synthesize and play a word/phrase (same path as overlay word taps). */
export function sendSpeakWordMessage({
  word,
  requestId,
  wordIndex = 0,
  endWordIndex = 0,
}: SpeakWordParams): void {
  const trimmed = word.trim();
  if (!trimmed) {
    return;
  }

  void browser.runtime.sendMessage({
    type: "speak-word",
    word: trimmed,
    wordIndex,
    endWordIndex,
    requestId,
  } satisfies Message);
}
