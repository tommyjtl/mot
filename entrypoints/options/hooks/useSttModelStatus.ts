import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOffscreenSttStatus,
  warmUpOffscreenStt,
} from "@/utils/offscreen-stt";
import { isSttModelCached } from "@/utils/stt/model-cache";
import type { SttModelLoadBroadcast } from "@/utils/stt/model-load-broadcast";
import type { Message } from "@/utils/messages";
import type { ModelCardView, TranscriptionStateResponse } from "../types";
import { queryWithRetry } from "../types";

const READY_MESSAGE = "Speech model ready.";
const ACTIVE_MESSAGE = "Transcription is active on a tab.";

export function useSttModelStatus(): ModelCardView {
  const [view, setView] = useState<ModelCardView>({
    state: "checking",
    detail: "Checking speech model…",
  });
  const warmupStartedRef = useRef(false);

  const startWarmup = useCallback(async () => {
    if (warmupStartedRef.current) {
      return;
    }

    warmupStartedRef.current = true;
    try {
      await warmUpOffscreenStt();
    } catch {
      // Progress and errors arrive via runtime broadcasts.
    } finally {
      warmupStartedRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setView({ state: "checking", detail: "Checking speech model…" });

    try {
      const status = await queryWithRetry(() => getOffscreenSttStatus());

      if (status === "ready") {
        setView({ state: "ready", detail: READY_MESSAGE });
        return;
      }

      if (status === "transcribing") {
        setView({ state: "ready", detail: ACTIVE_MESSAGE });
        return;
      }

      if (status === "loading") {
        setView({ state: "loading", detail: "Loading speech model…", percent: 0 });
        return;
      }

      const cached = await isSttModelCached();
      setView({
        state: "loading",
        detail: cached
          ? "Loading cached speech model…"
          : "Downloading speech model…",
        percent: 0,
      });
      void startWarmup();
    } catch {
      setView({
        state: "error",
        detail: "Could not reach the speech worker. Reload the extension and try again.",
      });
    }
  }, [startWarmup]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const listener = (
      message: SttModelLoadBroadcast | Message,
    ) => {
      if (message.type === "stt-model-load-progress") {
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
        return;
      }

      if (message.type === "transcription-state-changed") {
        if (message.active) {
          setView({ state: "ready", detail: ACTIVE_MESSAGE });
        } else {
          void refresh();
        }
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, [refresh]);

  return view;
}

export function useTranscriptionDebugState(): TranscriptionStateResponse & {
  unavailable: boolean;
} {
  const [state, setState] = useState<
    TranscriptionStateResponse & { unavailable: boolean }
  >({
    active: false,
    tabId: null,
    offscreenDocument: false,
    unavailable: false,
  });

  const refresh = useCallback(async () => {
    try {
      const next = (await queryWithRetry(() =>
        browser.runtime.sendMessage({
          type: "get-transcription-state",
        }),
      )) as TranscriptionStateResponse;
      setState({ ...next, unavailable: false });
    } catch {
      setState({
        active: false,
        tabId: null,
        offscreenDocument: false,
        unavailable: true,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  return state;
}
