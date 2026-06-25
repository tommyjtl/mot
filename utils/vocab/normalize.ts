/** Normalize a word/phrase for vocab lookup while preserving accents. */
export function normalizeVocabKey(text: string): string {
  let value = text.normalize("NFC").trim().toLocaleLowerCase("fr");
  value = value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return value;
}
