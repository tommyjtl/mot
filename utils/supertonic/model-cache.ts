import { MODEL_CACHE_NAME, modelAssetUrl, type ModelSource } from "./constants";
import { assetByteSize } from "./asset-sizes";
import {
  fetchModelAssetResponse,
  resetLocalModelServerProbe,
  resolveModelSource,
} from "./model-source";

export type DownloadProgressCallback = (loaded: number, total: number) => void;

/** Stable cache key regardless of whether the asset came from local or remote. */
function modelCacheUrl(relativePath: string): string {
  return modelAssetUrl(relativePath, "remote");
}

async function readResponseWithProgress(
  response: Response,
  path: string,
  onDownloadProgress?: DownloadProgressCallback,
): Promise<Response> {
  const expectedTotal =
    Number(response.headers.get("content-length") || 0) || assetByteSize(path);

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onDownloadProgress?.(buffer.byteLength, expectedTotal || buffer.byteLength);
    return new Response(buffer);
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

  onDownloadProgress?.(loaded, expectedTotal || loaded);
  return new Response(buffer.slice());
}

async function fetchWithProgress(
  path: string,
  source: ModelSource,
  onDownloadProgress?: DownloadProgressCallback,
): Promise<Response> {
  const response = await fetchModelAssetResponse(path, source);
  return readResponseWithProgress(response, path, onDownloadProgress);
}

async function fetchWithLocalFallback(
  path: string,
  onDownloadProgress?: DownloadProgressCallback,
): Promise<Response> {
  const source = await resolveModelSource();

  if (source === "remote") {
    return fetchWithProgress(path, "remote", onDownloadProgress);
  }

  try {
    return await fetchWithProgress(path, "local", onDownloadProgress);
  } catch {
    resetLocalModelServerProbe();
    return fetchWithProgress(path, "remote", onDownloadProgress);
  }
}

export async function fetchCachedAsset(
  path: string,
  onDownloadProgress?: DownloadProgressCallback,
): Promise<Response> {
  const cache = await caches.open(MODEL_CACHE_NAME);
  const cacheUrl = modelCacheUrl(path);
  const cached = await cache.match(cacheUrl);
  if (cached) {
    const buffer = await cached.arrayBuffer();
    onDownloadProgress?.(buffer.byteLength, buffer.byteLength);
    return new Response(buffer.slice(0));
  }

  const response = await fetchWithLocalFallback(path, onDownloadProgress);
  const buffer = await response.arrayBuffer();
  await cache.put(cacheUrl, new Response(buffer.slice(0)));
  return new Response(buffer.slice(0));
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
  const match = await cache.match(modelCacheUrl("onnx/tts.json"));
  return Boolean(match);
}

export async function clearModelCache(): Promise<void> {
  await caches.delete(MODEL_CACHE_NAME);
}
