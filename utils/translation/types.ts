/** Pluggable translation backends (Chrome built-in today, ONNX later). */

export type TranslationLanguage = "fr" | "en";

export type TranslationRequest = {
  text: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
};

export type TranslationResponse =
  | { ok: true; text: string }
  | { ok: false; error: string; unavailable?: boolean };

export interface TranslationProvider {
  readonly id: string;
  isSupported(): boolean;
  prepare?(request: {
    sourceLanguage: TranslationLanguage;
    targetLanguage: TranslationLanguage;
  }): Promise<boolean>;
  translate(request: TranslationRequest): Promise<TranslationResponse>;
}
