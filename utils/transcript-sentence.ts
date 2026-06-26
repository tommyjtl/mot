const SENTENCE_BOUNDARY =
  /(?<!M\.)(?<!Mme\.)(?<!Mlle\.)(?<!Dr\.)(?<!Prof\.)(?<!etc\.)(?<!ex\.)(?<!M\.)(?<=[.!?…»])\s+(?=\S)/;

export function isCompleteTranscriptSentence(sentence: string): boolean {
  return /[.!?…»]["'\)]*\s*$/.test(sentence.trim());
}

export function splitTranscriptSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(SENTENCE_BOUNDARY)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function partitionTranscriptSentences(text: string): {
  complete: string[];
  pending: string;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { complete: [], pending: "" };
  }

  const sentences = splitTranscriptSentences(trimmed);
  if (sentences.length === 0) {
    return { complete: [], pending: trimmed };
  }

  const last = sentences[sentences.length - 1]!;
  if (isCompleteTranscriptSentence(last)) {
    return { complete: sentences, pending: "" };
  }

  return {
    complete: sentences.slice(0, -1),
    pending: last,
  };
}

/** Source text for the sentence that should be translated in real time. */
export function getTranslatableLastSentence(text: string): string {
  const { complete, pending } = partitionTranscriptSentences(text);
  if (pending) {
    return pending;
  }

  return complete.at(-1) ?? text.trim();
}

/** Strip trailing sentence punctuation for comparison. */
export function normalizeTranslationSource(source: string): string {
  return source.trim().replace(/[.!?…»]["'\)]*\s*$/, "");
}

function loosenInlinePunctuation(source: string): string {
  return source.replace(/[,;:]/g, "").replace(/\s+/g, " ").trim();
}

/** Whether two transcript fragments refer to the same translatable chunk. */
export function translationSourcesMatch(a: string, b: string): boolean {
  const left = normalizeTranslationSource(a);
  const right = normalizeTranslationSource(b);
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  if (left.startsWith(right) || right.startsWith(left)) {
    return true;
  }

  const looseLeft = loosenInlinePunctuation(left);
  const looseRight = loosenInlinePunctuation(right);
  if (looseLeft === looseRight) {
    return true;
  }

  return (
    looseLeft.startsWith(looseRight) || looseRight.startsWith(looseLeft)
  );
}
