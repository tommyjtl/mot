/** Where Motif runs inference: on-device (private) or remote Python server (cloud). */

export type RuntimeMode = "private" | "cloud";

/** `null` until the user picks a mode in Options. */
export type RuntimeModeState = RuntimeMode | null;

export const RUNTIME_MODE_STORAGE_KEY = "motRuntimeMode";
export const REMOTE_API_BASE_URL_KEY = "motRemoteApiBaseUrl";

/** FRP tunnel: local gateway :8787 → EC2 :7016 → Caddy https://motif-cloud.tjtl.io */
export const DEFAULT_REMOTE_API_BASE_URL = "https://motif-cloud.tjtl.io";
export const LOCAL_GATEWAY_PORT = 8787;
export const FRP_REMOTE_PORT = 7016;

export function isRuntimeMode(value: unknown): value is RuntimeMode {
  return value === "private" || value === "cloud";
}

function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_REMOTE_API_BASE_URL;
  }

  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return DEFAULT_REMOTE_API_BASE_URL;
  }

  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return DEFAULT_REMOTE_API_BASE_URL;
  }
}

export type RuntimeModeSettings = {
  mode: RuntimeModeState;
  remoteApiBaseUrl: string;
};

export async function getRuntimeModeSettings(): Promise<RuntimeModeSettings> {
  const stored = await browser.storage.local.get([
    RUNTIME_MODE_STORAGE_KEY,
    REMOTE_API_BASE_URL_KEY,
  ]);

  const mode = stored[RUNTIME_MODE_STORAGE_KEY];
  return {
    mode: isRuntimeMode(mode) ? mode : null,
    remoteApiBaseUrl: normalizeBaseUrl(stored[REMOTE_API_BASE_URL_KEY]),
  };
}

export async function saveRuntimeMode(mode: RuntimeMode): Promise<void> {
  await browser.storage.local.set({ [RUNTIME_MODE_STORAGE_KEY]: mode });
}

export async function saveRemoteApiBaseUrl(baseUrl: string): Promise<void> {
  await browser.storage.local.set({
    [REMOTE_API_BASE_URL_KEY]: normalizeBaseUrl(baseUrl),
  });
}
