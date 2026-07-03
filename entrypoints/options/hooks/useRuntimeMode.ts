import { useCallback, useEffect, useState } from "react";
import { signOutFromCloud } from "@/utils/auth/auth-store";
import { fetchRemoteHealth } from "@/utils/remote-api";
import {
  DEFAULT_REMOTE_API_BASE_URL,
  saveRemoteApiBaseUrl,
  type RuntimeMode,
  type RuntimeModeState,
} from "@/utils/runtime-mode";
import {
  initRuntimeModeStore,
  runtimeModeStore,
  setRuntimeMode,
} from "@/utils/runtime-mode-store";
import { resetLearningTranslationReadiness } from "@/utils/translation/learning-translation";
import { useCloudAuth } from "./useCloudAuth";

export function useRuntimeMode() {
  const auth = useCloudAuth();
  const [mode, setModeState] = useState<RuntimeModeState>(null);
  const [remoteApiBaseUrl, setRemoteApiBaseUrl] = useState(
    DEFAULT_REMOTE_API_BASE_URL,
  );
  const [ready, setReady] = useState(false);
  const [remoteHealth, setRemoteHealth] = useState<
    "unknown" | "checking" | "ok" | "error"
  >("unknown");

  useEffect(() => {
    void initRuntimeModeStore().then(() => {
      const state = runtimeModeStore.getState();
      setModeState(state.mode);
      setRemoteApiBaseUrl(state.remoteApiBaseUrl || DEFAULT_REMOTE_API_BASE_URL);
      setReady(true);
    });

    return runtimeModeStore.subscribe(() => {
      const state = runtimeModeStore.getState();
      setModeState(state.mode);
      setRemoteApiBaseUrl(state.remoteApiBaseUrl || DEFAULT_REMOTE_API_BASE_URL);
    });
  }, []);

  useEffect(() => {
    if (!ready || mode !== "cloud") {
      setRemoteHealth("unknown");
      return;
    }

    let cancelled = false;
    setRemoteHealth("checking");

    void fetchRemoteHealth(remoteApiBaseUrl, { authenticated: auth.isSignedIn }).then(
      (health) => {
        if (cancelled) {
          return;
        }
        setRemoteHealth(health ? "ok" : "error");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [auth.isSignedIn, mode, ready, remoteApiBaseUrl]);

  const selectMode = useCallback(
    async (next: RuntimeMode) => {
      if (next === "cloud") {
        const session = auth.isSignedIn
          ? auth.session
          : await auth.ensureSession();

        if (!session) {
          return false;
        }
      } else {
        await signOutFromCloud();
      }

      await setRuntimeMode(next);
      resetLearningTranslationReadiness();
      return true;
    },
    [auth],
  );

  const updateRemoteApiBaseUrl = useCallback((value: string) => {
    setRemoteApiBaseUrl(value);
    void saveRemoteApiBaseUrl(value);
    resetLearningTranslationReadiness();
  }, []);

  return {
    mode,
    remoteApiBaseUrl,
    remoteHealth,
    ready: ready && auth.ready,
    auth,
    selectMode,
    setRemoteApiBaseUrl: updateRemoteApiBaseUrl,
  };
}
