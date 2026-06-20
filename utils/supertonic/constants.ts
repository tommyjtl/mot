export const HF_MODEL_REPO = "Supertone/supertonic-3";

export const HF_BASE_URL = `https://huggingface.co/${HF_MODEL_REPO}/resolve/main`;

export type ModelSource = "local" | "remote";

/** Switch to `"remote"` to load from Hugging Face instead of the local dev server. */
export const MODEL_SOURCE: ModelSource = "local";

export const LOCAL_MODEL_HOST = "127.0.0.1";
export const LOCAL_MODEL_PORT = 8091;
export const LOCAL_MODEL_BASE_URL = `http://${LOCAL_MODEL_HOST}:${LOCAL_MODEL_PORT}`;

export const MODEL_CACHE_NAME = "mot-supertonic-v3";

export const ONNX_FILES = [
  "onnx/tts.json",
  "onnx/unicode_indexer.json",
  "onnx/duration_predictor.onnx",
  "onnx/text_encoder.onnx",
  "onnx/vector_estimator.onnx",
  "onnx/vocoder.onnx",
] as const;

export const ONNX_MODEL_FILES = [
  "onnx/duration_predictor.onnx",
  "onnx/text_encoder.onnx",
  "onnx/vector_estimator.onnx",
  "onnx/vocoder.onnx",
] as const;

export const DEFAULT_TOTAL_STEPS = 8;
export const DEFAULT_SPEED = 0.95;
export const DEFAULT_SILENCE_DURATION = 0.3;

/** Show sync-debug toggle, segment list, and tuning sliders in the overlay footer. */
export const ALIGNMENT_DEBUG_UI_ENABLED = false;

export const AVAILABLE_LANGS = [
  "en",
  "ko",
  "ja",
  "ar",
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "es",
  "et",
  "fi",
  "fr",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "lt",
  "lv",
  "nl",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sv",
  "tr",
  "uk",
  "vi",
  "na",
] as const;

export type SupertonicLang = (typeof AVAILABLE_LANGS)[number];

export function modelAssetBaseUrl(source: ModelSource = MODEL_SOURCE): string {
  return source === "local" ? LOCAL_MODEL_BASE_URL : HF_BASE_URL;
}

export function modelAssetUrl(
  relativePath: string,
  source: ModelSource = MODEL_SOURCE,
): string {
  return `${modelAssetBaseUrl(source)}/${relativePath}`;
}

/** @deprecated Use {@link modelAssetUrl} instead. */
export function hfAssetUrl(relativePath: string): string {
  return modelAssetUrl(relativePath, "remote");
}

export function voiceStylePath(voice: string): string {
  return `voice_styles/${voice}.json`;
}
