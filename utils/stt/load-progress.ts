import { STT_MODEL_DOWNLOAD_TOTAL_BYTES } from "./constants";

export function formatSttStatusText(text: string): string {
  const normalized = text.trim();

  if (/^downloading model/i.test(normalized)) {
    return "Downloading speech model…";
  }

  if (/^loading wasm module/i.test(normalized)) {
    return "Loading speech engine…";
  }

  if (/^initializing webgpu/i.test(normalized)) {
    return "Initializing WebGPU…";
  }

  if (/^loading model into webgpu/i.test(normalized)) {
    return "Loading speech model into GPU…";
  }

  if (/^loading audio codec/i.test(normalized)) {
    return "Loading audio codec…";
  }

  if (/^loading tokenizer/i.test(normalized)) {
    return "Loading tokenizer…";
  }

  if (/^loading vad model/i.test(normalized)) {
    return "Loading voice detector…";
  }

  if (/^warming up gpu/i.test(normalized)) {
    return "Warming up GPU…";
  }

  if (/^listening/i.test(normalized)) {
    return "Listening for tab audio…";
  }

  if (/^processing/i.test(normalized)) {
    return "Updating transcript…";
  }

  if (/^capturing tab audio/i.test(normalized)) {
    return "Connecting to tab audio…";
  }

  if (/^loading speech model/i.test(normalized)) {
    return normalized;
  }

  return normalized.endsWith("…") ? normalized : `${normalized}…`;
}

export function sttDownloadPercent(progress?: {
  loaded: number;
  total: number;
}): number | undefined {
  if (!progress || progress.total <= 0) {
    return undefined;
  }

  return Math.min(99, Math.round((progress.loaded / progress.total) * 100));
}

/** Rough overall percent when the worker only reports the current file. */
export function sttOverallDownloadPercent(progress?: {
  loaded: number;
  total: number;
}): number | undefined {
  if (!progress?.loaded) {
    return undefined;
  }

  const totalBytes = Math.max(
    progress.total || STT_MODEL_DOWNLOAD_TOTAL_BYTES,
    STT_MODEL_DOWNLOAD_TOTAL_BYTES,
  );

  return Math.min(99, Math.round((progress.loaded / totalBytes) * 100));
}
