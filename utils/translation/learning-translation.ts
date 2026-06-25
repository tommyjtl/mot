import { chromeTranslatorProvider } from "./chrome-translator";
import type { TranslationProvider, TranslationResponse } from "./types";

const LEARNING_SOURCE = "fr" as const;
const LEARNING_TARGET = "en" as const;

/** Default on-device translation backend for Motif (Chrome today, swappable later). */
export const learningTranslationProvider: TranslationProvider =
  chromeTranslatorProvider;

export type LearningTranslationReadiness =
  | "idle"
  | "unsupported"
  | "loading"
  | "ready"
  | "unavailable";

let readiness: LearningTranslationReadiness =
  learningTranslationProvider.isSupported() ? "idle" : "unsupported";

let preparePromise: Promise<LearningTranslationReadiness> | null = null;
const readinessListeners = new Set<() => void>();

function setReadiness(next: LearningTranslationReadiness): void {
  if (readiness === next) {
    return;
  }

  readiness = next;
  for (const listener of readinessListeners) {
    listener();
  }
}

export function getLearningTranslationReadiness(): LearningTranslationReadiness {
  return readiness;
}

export function subscribeLearningTranslationReadiness(
  listener: () => void,
): () => void {
  readinessListeners.add(listener);
  return () => {
    readinessListeners.delete(listener);
  };
}

/** Browser exposes the Translator API (sync check). */
export function isLearningTranslationSupported(): boolean {
  return learningTranslationProvider.isSupported();
}

/** Translator model is loaded and usable. */
export function isLearningTranslationReady(): boolean {
  return readiness === "ready";
}

export async function prepareLearningTranslation(): Promise<LearningTranslationReadiness> {
  if (!learningTranslationProvider.isSupported()) {
    setReadiness("unsupported");
    return "unsupported";
  }

  if (readiness === "ready") {
    return "ready";
  }

  if (preparePromise) {
    return preparePromise;
  }

  setReadiness("loading");

  preparePromise = (async () => {
    try {
      const prepared = await learningTranslationProvider.prepare?.({
        sourceLanguage: LEARNING_SOURCE,
        targetLanguage: LEARNING_TARGET,
      });

      const next: LearningTranslationReadiness = prepared ? "ready" : "unavailable";
      setReadiness(next);
      return next;
    } catch {
      setReadiness("unavailable");
      return "unavailable";
    } finally {
      preparePromise = null;
    }
  })();

  return preparePromise;
}

export async function translateForLearning(
  text: string,
): Promise<TranslationResponse> {
  if (!learningTranslationProvider.isSupported()) {
    return {
      ok: false,
      error: "On-device translation is not available in this browser.",
      unavailable: true,
    };
  }

  if (!isLearningTranslationReady()) {
    const state = await prepareLearningTranslation();
    if (state !== "ready") {
      return {
        ok: false,
        error:
          state === "loading"
            ? "Translation model is still loading."
            : "Translation model is unavailable for this language pair.",
        unavailable: true,
      };
    }
  }

  return learningTranslationProvider.translate({
    text,
    sourceLanguage: LEARNING_SOURCE,
    targetLanguage: LEARNING_TARGET,
  });
}
