/** Strip leading/trailing non-letter/non-number characters; preserve case for display. */
export function sanitizeVocabOriginal(text: string): string {
  const trimmed = text.normalize("NFC").trim();
  return trimmed.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Normalize a word/phrase for vocab lookup while preserving accents. */
export function normalizeVocabKey(text: string): string {
  return sanitizeVocabOriginal(text).toLocaleLowerCase("fr");
}
