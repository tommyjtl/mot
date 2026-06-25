import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResponse,
} from "./types";

type TranslatorAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";

type ChromeTranslator = {
  translate(input: string): Promise<string>;
  destroy(): void;
};

type ChromeTranslatorConstructor = {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslatorAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<ChromeTranslator>;
};

declare global {
  // Chrome built-in AI Translator API (desktop Chrome 138+).
  // eslint-disable-next-line no-var
  var Translator: ChromeTranslatorConstructor | undefined;
}

const translatorCache = new Map<string, Promise<ChromeTranslator | null>>();

function cacheKey(sourceLanguage: string, targetLanguage: string): string {
  return `${sourceLanguage}->${targetLanguage}`;
}

async function loadTranslator(
  sourceLanguage: string,
  targetLanguage: string,
): Promise<ChromeTranslator | null> {
  if (typeof Translator === "undefined") {
    return null;
  }

  const availability = await Translator.availability({
    sourceLanguage,
    targetLanguage,
  });

  if (availability === "unavailable") {
    return null;
  }

  return Translator.create({ sourceLanguage, targetLanguage });
}

async function getTranslator(
  sourceLanguage: string,
  targetLanguage: string,
): Promise<ChromeTranslator | null> {
  const key = cacheKey(sourceLanguage, targetLanguage);
  let pending = translatorCache.get(key);

  if (!pending) {
    pending = loadTranslator(sourceLanguage, targetLanguage).catch(() => null);
    translatorCache.set(key, pending);
  }

  const translator = await pending;
  if (!translator) {
    translatorCache.delete(key);
  }

  return translator;
}

export const chromeTranslatorProvider: TranslationProvider = {
  id: "chrome-translator",

  isSupported(): boolean {
    return typeof Translator !== "undefined";
  },

  async prepare({
    sourceLanguage,
    targetLanguage,
  }: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const translator = await getTranslator(sourceLanguage, targetLanguage);
    return translator !== null;
  },

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const trimmed = request.text.trim();
    if (!trimmed) {
      return { ok: false, error: "Nothing to translate." };
    }

    if (!this.isSupported()) {
      return {
        ok: false,
        error: "On-device translation is not available in this browser.",
        unavailable: true,
      };
    }

    try {
      const translator = await getTranslator(
        request.sourceLanguage,
        request.targetLanguage,
      );

      if (!translator) {
        return {
          ok: false,
          error: "Translation model is unavailable for this language pair.",
          unavailable: true,
        };
      }

      const text = await translator.translate(trimmed);
      return { ok: true, text };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error.message : "Translation failed.",
      };
    }
  },
};
