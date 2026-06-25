/** On-device Kyutai STT 1B EN/FR via [stt-web](https://github.com/idle-intelligence/stt-web). */

export const STT_HF_REPO = "idle-intelligence/stt-1b-en_fr-q4_0-webgpu";

export const STT_HF_BASE = `https://huggingface.co/${STT_HF_REPO}/resolve/main`;

/** Approximate total first-run download size for progress UI (~640 MB weights + aux files). */
export const STT_MODEL_DOWNLOAD_TOTAL_BYTES = 640 * 1024 * 1024;

export const STT_VISIBLE_LINES = 4;

export function sttAssetUrl(relativePath: string): string {
  const trimmed = relativePath.replace(/^\//, "");
  return browser.runtime.getURL(trimmed ? `stt/${trimmed}` : "stt/");
}

export function sttRuntimeBaseUrl(): string {
  return sttAssetUrl("").replace(/\/$/, "");
}
