export {
  getLearningTranslationProvider,
  getLearningTranslationReadiness,
  isLearningTranslationReady,
  isLearningTranslationSupported,
  prepareLearningTranslation,
  resetLearningTranslationReadiness,
  subscribeLearningTranslationReadiness,
  translateForLearning,
} from "./learning-translation";
export type { LearningTranslationReadiness } from "./learning-translation";
export { chromeTranslatorProvider } from "./chrome-translator";
export { remoteTranslatorProvider } from "./remote-translator";
export type {
  TranslationLanguage,
  TranslationProvider,
  TranslationRequest,
  TranslationResponse,
} from "./types";
