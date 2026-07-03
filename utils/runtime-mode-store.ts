import { createStore } from "@/lib/create-store";
import {
  getRuntimeModeSettings,
  isRuntimeMode,
  REMOTE_API_BASE_URL_KEY,
  RUNTIME_MODE_STORAGE_KEY,
  saveRuntimeMode,
  type RuntimeMode,
  type RuntimeModeSettings,
  type RuntimeModeState,
} from "./runtime-mode";

type RuntimeModeStoreState = RuntimeModeSettings & {
  initialized: boolean;
};

const initialState: RuntimeModeStoreState = {
  mode: null,
  remoteApiBaseUrl: "",
  initialized: false,
};

export const runtimeModeStore = createStore<RuntimeModeStoreState>(initialState);

let initPromise: Promise<void> | null = null;

export async function initRuntimeModeStore(): Promise<void> {
  if (runtimeModeStore.getState().initialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const settings = await getRuntimeModeSettings();
    runtimeModeStore.setState({ ...settings, initialized: true });
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

export function bindRuntimeModeSync(): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }

    const patch: Partial<RuntimeModeStoreState> = {};

    if (changes[RUNTIME_MODE_STORAGE_KEY]) {
      const next = changes[RUNTIME_MODE_STORAGE_KEY].newValue;
      patch.mode = isRuntimeMode(next) ? next : null;
    }

    if (changes[REMOTE_API_BASE_URL_KEY]) {
      const next = changes[REMOTE_API_BASE_URL_KEY].newValue;
      if (typeof next === "string") {
        patch.remoteApiBaseUrl = next;
      }
    }

    if (Object.keys(patch).length > 0) {
      runtimeModeStore.setState(patch);
    }
  });
}

export function getRuntimeMode(): RuntimeModeState {
  return runtimeModeStore.getState().mode;
}

export function getRemoteApiBaseUrl(): string {
  return runtimeModeStore.getState().remoteApiBaseUrl;
}

export function isRuntimeModeReady(): boolean {
  return runtimeModeStore.getState().mode !== null;
}

export function isPrivateRuntimeMode(): boolean {
  return runtimeModeStore.getState().mode === "private";
}

export function isCloudRuntimeMode(): boolean {
  return runtimeModeStore.getState().mode === "cloud";
}

export async function setRuntimeMode(mode: RuntimeMode): Promise<void> {
  await saveRuntimeMode(mode);
  runtimeModeStore.setState({ mode });
}
