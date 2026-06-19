/** Approximate Hugging Face asset sizes for weighted download progress. */

export const MODEL_DOWNLOAD_ASSETS = [
  { path: "onnx/tts.json", bytes: 8_253 },
  { path: "onnx/unicode_indexer.json", bytes: 277_676 },
  { path: "onnx/duration_predictor.onnx", bytes: 3_700_147 },
  { path: "onnx/text_encoder.onnx", bytes: 36_416_150 },
  { path: "onnx/vector_estimator.onnx", bytes: 256_534_781 },
  { path: "onnx/vocoder.onnx", bytes: 101_424_195 },
] as const;

export const VOICE_STYLE_BYTES = 290_000;

export const INIT_SESSION_STEPS = 4;

export function assetByteSize(path: string): number {
  const asset = MODEL_DOWNLOAD_ASSETS.find((entry) => entry.path === path);
  if (asset) {
    return asset.bytes;
  }
  if (path.startsWith("voice_styles/")) {
    return VOICE_STYLE_BYTES;
  }
  return 0;
}

export const MODEL_DOWNLOAD_TOTAL_BYTES = MODEL_DOWNLOAD_ASSETS.reduce(
  (total, asset) => total + asset.bytes,
  0,
);
