import type { TranslationState } from "../../components/overlay/TranslationPanel";

type WordTranslationFields = {
  contextText: string;
  pageUrl: string;
  pageTitle: string;
};

export function getWordTranslationVocabContext(
  contextText: string,
): WordTranslationFields {
  return {
    contextText,
    pageUrl: location.href,
    pageTitle: document.title,
  };
}

type WordTranslationInput = WordTranslationFields & {
  originalText: string;
  translationText: string;
  loading?: boolean;
  vocabReady?: boolean;
};

export function buildWordTranslationState(
  input: WordTranslationInput,
): Extract<TranslationState, { visible: true }> {
  return {
    visible: true,
    originalText: input.originalText,
    translationText: input.translationText,
    mode: "word",
    loading: input.loading,
    vocabReady: input.vocabReady,
    contextText: input.contextText,
    pageUrl: input.pageUrl,
    pageTitle: input.pageTitle,
  };
}
