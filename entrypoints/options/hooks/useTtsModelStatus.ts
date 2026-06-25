import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOffscreenModelStatus,
  warmUpOffscreenTts,
} from "@/utils/offscreen-tts";
import { isModelCached } from "@/utils/supertonic/model-cache";
import type { ModelLoadBroadcastMessage } from "@/utils/messages";
import type { ModelCardView } from "../types";
import { queryWithRetry } from "../types";

const READY_MESSAGE = "Text-to-speech model ready.";

export function useTtsModelStatus(): ModelCardView {
  const [view, setView] = useState<ModelCardView>({
    state: "checking",
    detail: "Checking text-to-speech model…",
  });
  const warmupStartedRef = useRef(false);

  const startWarmup = useCallback(async () => {
    if (warmupStartedRef.current) {
      return;
    }

    warmupStartedRef.current = true;
    try {
      await warmUpOffscreenTts();
    } catch {
      // Progress and errors arrive via runtime broadcasts.
    } finally {
      warmupStartedRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setView({ state: "checking", detail: "Checking text-to-speech model…" });

    try {
      const status = await queryWithRetry(() => getOffscreenModelStatus());

      if (status === "ready") {
        setView({ state: "ready", detail: READY_MESSAGE });
        return;
      }

      if (status === "loading") {
        setView({ state: "loading", detail: "Loading text-to-speech model…", percent: 0 });
        return;
      }

      const cached = await isModelCached();
      setView({
        state: "loading",
        detail: cached
          ? "Loading cached text-to-speech model…"
          : "Downloading text-to-speech model…",
        percent: 0,
      });
      void startWarmup();
    } catch {
      setView({
        state: "error",
        detail: "Could not reach the TTS worker. Reload the extension and try again.",
      });
    }
  }, [startWarmup]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const listener = (message: ModelLoadBroadcastMessage) => {
      if (message.type !== "model-load-progress") {
        return;
      }

      if (message.phase === "loading-model") {
        setView({
          state: "loading",
          detail: message.detail,
          percent: message.percent,
        });
        return;
      }

      if (message.phase === "ready") {
        setView({
          state: "ready",
          detail: message.detail || READY_MESSAGE,
        });
        return;
      }

      if (message.phase === "error") {
        setView({ state: "error", detail: message.detail });
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return view;
}
