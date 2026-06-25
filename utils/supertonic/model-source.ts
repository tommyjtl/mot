import {
  LOCAL_MODEL_BASE_URL,
  modelAssetUrl,
  type ModelSource,
} from "./constants";

const LOCAL_PROBE_PATH = "onnx/tts.json";
const LOCAL_PROBE_TIMEOUT_MS = 1500;
const LOCAL_PROBE_TTL_MS = 30_000;

type LocalAvailability = {
  available: boolean;
  checkedAt: number;
};

let localAvailability: LocalAvailability | null = null;

export function resetLocalModelServerProbe(): void {
  localAvailability = null;
}

async function probeLocalModelServer(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    LOCAL_PROBE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${LOCAL_MODEL_BASE_URL}/${LOCAL_PROBE_PATH}`,
      {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      },
    );
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/** Prefer local dev server when reachable; otherwise Hugging Face. */
export async function resolveModelSource(): Promise<ModelSource> {
  const now = Date.now();
  if (
    localAvailability &&
    now - localAvailability.checkedAt < LOCAL_PROBE_TTL_MS
  ) {
    return localAvailability.available ? "local" : "remote";
  }

  const available = await probeLocalModelServer();
  localAvailability = { available, checkedAt: now };
  return available ? "local" : "remote";
}

async function readHttpErrorBody(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("json")) {
      const body: unknown = await response.json();
      return JSON.stringify(body, null, 2);
    }

    const text = (await response.text()).trim();
    if (text) {
      return text;
    }
  } catch {
    // Fall back to status line below.
  }

  return response.statusText || "Request failed";
}

export async function fetchModelAssetResponse(
  relativePath: string,
  source: ModelSource,
): Promise<Response> {
  const url = modelAssetUrl(relativePath, source);
  const response = await fetch(url);
  if (!response.ok) {
    const body = await readHttpErrorBody(response);
    throw new Error(
      `Failed to download ${relativePath} from ${source} (${response.status}): ${body}`,
    );
  }
  return response;
}
