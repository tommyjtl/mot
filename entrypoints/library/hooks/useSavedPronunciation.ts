import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/utils/messages";
import { sendSpeakWordMessage } from "@/utils/speak-word-client";

export type SavedSpeakHighlight = "idle" | "loading" | "active";

export function useSavedPronunciation() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<SavedSpeakHighlight>("idle");
  const [error, setError] = useState<string | null>(null);
  const speakRequestIdRef = useRef<number | null>(null);
  const awaitingPlaybackRef = useRef(false);

  useEffect(() => {
    const listener = (message: Message) => {
      if (message.type === "word-tts-result") {
        if (message.requestId !== speakRequestIdRef.current) {
          return;
        }

        speakRequestIdRef.current = null;

        if (!message.payload.ok) {
          awaitingPlaybackRef.current = false;
          setHighlight("idle");
          setActiveKey(null);
          setError(message.payload.error);
          return;
        }

        awaitingPlaybackRef.current = true;
        setHighlight("active");
        setError(null);
        return;
      }

      if (message.type !== "tts-playback") {
        return;
      }

      if (!awaitingPlaybackRef.current) {
        return;
      }

      if (message.state === "paused" || message.state === "ended") {
        awaitingPlaybackRef.current = false;
        setHighlight("idle");
        setActiveKey(null);
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const speak = useCallback((text: string, key: string) => {
    const trimmed = text.trim();
    if (!trimmed || highlight === "loading") {
      return;
    }

    const requestId = Date.now();
    speakRequestIdRef.current = requestId;
    awaitingPlaybackRef.current = false;
    setActiveKey(key);
    setHighlight("loading");
    setError(null);

    sendSpeakWordMessage({ word: trimmed, requestId });
  }, [highlight]);

  const getHighlight = useCallback(
    (key: string): SavedSpeakHighlight =>
      activeKey === key ? highlight : "idle",
    [activeKey, highlight],
  );

  return {
    speak,
    getHighlight,
    error,
    clearError: () => setError(null),
  };
}
