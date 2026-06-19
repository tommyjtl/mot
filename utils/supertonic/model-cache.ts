import { MODEL_CACHE_NAME, modelAssetUrl } from "./constants";
import { assetByteSize } from "./asset-sizes";

export type DownloadProgressCallback = (loaded: number, total: number) => void;

export async function fetchCachedAsset(
  path: string,
  onDownloadProgress?: DownloadProgressCallback,
): Promise<Response> {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const url = modelAssetUrl(path);
  const cached = await cache.match(url);
  if (cached) {
    const buffer = await cached.arrayBuffer();
    onDownloadProgress?.(buffer.byteLength, buffer.byteLength);
    return cached;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${path} (${response.status})`);
  }

  const expectedTotal =
    Number(response.headers.get("content-length") || 0) || assetByteSize(path);

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onDownloadProgress?.(buffer.byteLength, expectedTotal || buffer.byteLength);
    await cache.put(url, new Response(buffer.slice(0)));
    return cache.match(url) ?? new Response(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    loaded += value.byteLength;
    onDownloadProgress?.(loaded, expectedTotal || loaded);
  }

  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const cachedResponse = new Response(buffer.slice());
  await cache.put(url, cachedResponse.clone());
  onDownloadProgress?.(loaded, expectedTotal || loaded);
  return cachedResponse;
}

export async function fetchCachedJson<T>(
  path: string,
  onDownloadProgress?: DownloadProgressCallback,
): Promise<T> {
  const response = await fetchCachedAsset(path, onDownloadProgress);
  return (await response.json()) as T;
}

export async function fetchCachedArrayBuffer(
  path: string,
  onDownloadProgress?: DownloadProgressCallback,
): Promise<ArrayBuffer> {
  const response = await fetchCachedAsset(path, onDownloadProgress);
  return response.arrayBuffer();
}

export async function isModelCached(): Promise<boolean> {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const match = await cache.match(modelAssetUrl("onnx/tts.json"));
  return Boolean(match);
}

export async function clearModelCache(): Promise<void> {
  await caches.delete(MODEL_CACHE_NAME);
}
