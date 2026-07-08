import { sanitizeVocabOriginal } from "./vocab/normalize";

/** Strip leading/trailing characters that are not letters or digits. */
export function normalizeDictionaryLookupWord(word: string): string {
  return sanitizeVocabOriginal(word);
}

export function buildWordReferenceUrl(word: string): string {
  const lookupWord = normalizeDictionaryLookupWord(word);
  return `https://www.wordreference.com/fren/${encodeURIComponent(lookupWord)}`;
}
