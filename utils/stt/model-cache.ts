/** Matches `CACHE_NAME` in public/stt/worker.js */
export const STT_MODEL_CACHE_NAME = "mot-stt-model-v1";

export async function isSttModelCached(): Promise<boolean> {
  try {
    const cache = await caches.open(STT_MODEL_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length > 0;
  } catch {
    return false;
  }
}
