import { chromeTranslatorProvider } from "./chrome-translator";
import { remoteTranslatorProvider } from "./remote-translator";
import {
  getRuntimeMode,
  initRuntimeModeStore,
  isCloudRuntimeMode,
  isPrivateRuntimeMode,
  runtimeModeStore,
} from "../runtime-mode-store";
import { fetchRemoteHealth } from "../remote-api";
import type { TranslationProvider, TranslationResponse } from "./types";

const LEARNING_SOURCE = "fr" as const;
const LEARNING_TARGET = "en" as const;

function resolveLearningTranslationProvider(): TranslationProvider {
  if (isCloudRuntimeMode()) {
    return remoteTranslatorProvider;
  }

  return chromeTranslatorProvider;
}

export function getLearningTranslationProvider(): TranslationProvider {
  return resolveLearningTranslationProvider();
}

export type LearningTranslationReadiness =
  | "idle"
  | "unsupported"
  | "loading"
  | "ready"
  | "unavailable";

let readiness: LearningTranslationReadiness = "idle";
let activeProviderId: string | null = null;

let preparePromise: Promise<LearningTranslationReadiness> | null = null;
const readinessListeners = new Set<() => void>();

function syncProviderReadiness(): void {
  const provider = resolveLearningTranslationProvider();

  if (activeProviderId !== provider.id) {
    activeProviderId = provider.id;
    readiness = provider.isSupported() ? "idle" : "unsupported";
    preparePromise = null;
  }
}

function setReadiness(next: LearningTranslationReadiness): void {
  if (readiness === next) {
    return;
  }

  readiness = next;
  for (const listener of readinessListeners) {
    listener();
  }
}

export function resetLearningTranslationReadiness(): void {
  syncProviderReadiness();
  for (const listener of readinessListeners) {
    listener();
  }
}

export function getLearningTranslationReadiness(): LearningTranslationReadiness {
  syncProviderReadiness();
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

/** Translation is available for the active runtime mode. */
export function isLearningTranslationSupported(): boolean {
  syncProviderReadiness();
  return resolveLearningTranslationProvider().isSupported();
}

/** Translator backend is loaded and usable. */
export function isLearningTranslationReady(): boolean {
  return readiness === "ready";
}

export async function prepareLearningTranslation(): Promise<LearningTranslationReadiness> {
  await initRuntimeModeStore();
  syncProviderReadiness();

  const provider = resolveLearningTranslationProvider();
  const mode = getRuntimeMode();

  if (mode === null) {
    setReadiness("unsupported");
    return "unsupported";
  }

  if (!provider.isSupported()) {
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
      if (isPrivateRuntimeMode()) {
        const prepared = await provider.prepare?.({
          sourceLanguage: LEARNING_SOURCE,
          targetLanguage: LEARNING_TARGET,
        });
        const next: LearningTranslationReadiness = prepared
          ? "ready"
          : "unavailable";
        setReadiness(next);
        return next;
      }

      const health = await fetchRemoteHealth();
      const next: LearningTranslationReadiness = health ? "ready" : "unavailable";
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
  await initRuntimeModeStore();
  syncProviderReadiness();

  const provider = resolveLearningTranslationProvider();

  if (getRuntimeMode() === null) {
    return {
      ok: false,
      error: "Choose Private or Cloud mode in Motif Options first.",
      unavailable: true,
    };
  }

  if (!provider.isSupported()) {
    return {
      ok: false,
      error: isCloudRuntimeMode()
        ? "Remote translation is unavailable. Check your Motif server URL."
        : "On-device translation is not available in this browser.",
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
            ? "Translation is still starting."
            : isCloudRuntimeMode()
              ? "Motif server is unreachable."
              : "Translation model is unavailable for this language pair.",
        unavailable: true,
      };
    }
  }

  return provider.translate({
    text,
    sourceLanguage: LEARNING_SOURCE,
    targetLanguage: LEARNING_TARGET,
  });
}

runtimeModeStore.subscribe(() => {
  resetLearningTranslationReadiness();
});
