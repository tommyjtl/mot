/** Strip leading/trailing characters that are not letters or digits. */
export function normalizeDictionaryLookupWord(word: string): string {
  const trimmed = word.trim();
  const normalized = trimmed.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
  return normalized || trimmed;
}

export function buildWordReferenceUrl(word: string): string {
  const lookupWord = normalizeDictionaryLookupWord(word);
  return `https://www.wordreference.com/fren/${encodeURIComponent(lookupWord)}`;
}
