import { useCallback, useEffect, useRef, useState } from "react";
import type { WordRange } from "@/components/overlay/InteractiveWordText";
import type { Message } from "@/utils/messages";
import { estimateAlignmentFromAudio } from "@/utils/alignment-from-audio";
import { phraseFromWordRange } from "@/utils/overlay-phrase";
import { overlayWordIndexAtTime } from "@/utils/overlay-word-sync";
import { sendSpeakWordMessage } from "@/utils/speak-word-client";
import type { TtsAlignment } from "@/utils/tts-types";

function alignmentDuration(alignment: TtsAlignment | null): number {
  const lastEnd = alignment?.words.at(-1)?.end;
  return lastEnd && lastEnd > 0 ? lastEnd : 0;
}

type PronunciationSession = {
  surfaceKey: string | null;
  pinnedWordStart: number | null;
  pinnedWordEnd: number | null;
  pinnedPhraseText: string | null;
  playbackAlignment: TtsAlignment | null;
  playbackDuration: number;
  playbackTime: number;
  isPlaying: boolean;
};

function createEmptySession(): PronunciationSession {
  return {
    surfaceKey: null,
    pinnedWordStart: null,
    pinnedWordEnd: null,
    pinnedPhraseText: null,
    playbackAlignment: null,
    playbackDuration: 0,
    playbackTime: 0,
    isPlaying: false,
  };
}

export type LibrarySurfaceState = {
  highlight: WordRange | null;
  loading: WordRange | null;
  phraseRange: WordRange | null;
};

const idleSurfaceState: LibrarySurfaceState = {
  highlight: null,
  loading: null,
  phraseRange: null,
};

export function useLibraryWordPronunciation(enabled: boolean) {
  const [activeSurfaceKey, setActiveSurfaceKey] = useState<string | null>(null);
  const [wordHighlight, setWordHighlight] = useState<WordRange | null>(null);
  const [wordLoading, setWordLoading] = useState<WordRange | null>(null);
  const [phraseRange, setPhraseRange] = useState<WordRange | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wordSynthRequestIdRef = useRef(0);
  const sessionRef = useRef<PronunciationSession | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createEmptySession();
  }
  const highlightLoopRef = useRef<number | null>(null);
  const loadingRef = useRef(false);

  const stopHighlightLoop = useCallback(() => {
    if (highlightLoopRef.current !== null) {
      cancelAnimationFrame(highlightLoopRef.current);
      highlightLoopRef.current = null;
    }
  }, []);

  const resetPronunciation = useCallback(() => {
    stopHighlightLoop();
    sessionRef.current = createEmptySession();
    wordSynthRequestIdRef.current = 0;
    loadingRef.current = false;
    setActiveSurfaceKey(null);
    setWordHighlight(null);
    setWordLoading(null);
    setPhraseRange(null);
    setError(null);
  }, [stopHighlightLoop]);

  const syncHighlight = useCallback(() => {
    const session = sessionRef.current!;
    if (!session.isPlaying || session.pinnedWordStart === null) {
      return;
    }

    const end = session.pinnedWordEnd ?? session.pinnedWordStart;
    const isPhrase = end > session.pinnedWordStart;

    if (isPhrase) {
      let activeIndex = session.pinnedWordStart;
      if (session.playbackAlignment?.words.length && session.pinnedPhraseText) {
        const localIndex = overlayWordIndexAtTime(
          session.pinnedPhraseText,
          session.playbackTime,
          session.playbackDuration,
          session.playbackAlignment,
        );

        if (localIndex !== null) {
          activeIndex = session.pinnedWordStart + localIndex;
        }
      }

      setWordHighlight({ start: activeIndex, end: activeIndex });
      setPhraseRange({ start: session.pinnedWordStart, end });
      return;
    }

    setPhraseRange(null);
    setWordHighlight({ start: session.pinnedWordStart, end });
  }, []);

  const startHighlightLoop = useCallback(() => {
    if (highlightLoopRef.current !== null) {
      return;
    }

    const tick = () => {
      syncHighlight();
      highlightLoopRef.current = requestAnimationFrame(tick);
    };

    highlightLoopRef.current = requestAnimationFrame(tick);
  }, [syncHighlight]);

  useEffect(() => {
    if (enabled) {
      return;
    }

    stopHighlightLoop();
    sessionRef.current = createEmptySession();
    wordSynthRequestIdRef.current = 0;
    loadingRef.current = false;
  }, [enabled, stopHighlightLoop]);

  useEffect(() => {
    const listener = (message: Message) => {
      if (!enabled) {
        return;
      }

      if (message.type === "word-tts-result") {
        if (message.requestId !== wordSynthRequestIdRef.current) {
          return;
        }

        loadingRef.current = false;
        setWordLoading(null);

        if (!message.payload.ok) {
          sessionRef.current = createEmptySession();
          setActiveSurfaceKey(null);
          setWordHighlight(null);
          setPhraseRange(null);
          setError(message.payload.error);
          return;
        }

        const aligned =
          estimateAlignmentFromAudio(
            message.payload.audioBase64,
            message.payload.word,
          ) ??
          message.payload.alignment ??
          null;

        const start = message.wordIndex;
        const end = message.endWordIndex ?? message.wordIndex;

        const session = sessionRef.current!;
        sessionRef.current = {
          ...session,
          pinnedWordStart: start,
          pinnedWordEnd: end,
          pinnedPhraseText: message.payload.word,
          playbackAlignment: aligned,
          playbackDuration: alignmentDuration(aligned),
          playbackTime: 0,
          isPlaying: true,
        };

        if (end > start) {
          setPhraseRange({ start, end });
        } else {
          setPhraseRange(null);
        }

        setWordHighlight({ start, end: start });
        setError(null);
        startHighlightLoop();
        return;
      }

      if (message.type !== "tts-playback") {
        return;
      }

      const session = sessionRef.current!;
      if (!session.isPlaying) {
        return;
      }

      if (message.duration > 0) {
        session.playbackDuration = message.duration;
      }
      session.playbackTime = message.currentTime;

      if (message.state === "paused" || message.state === "ended") {
        session.isPlaying = false;
        stopHighlightLoop();
        setActiveSurfaceKey(null);
        setWordHighlight(null);
        setPhraseRange(null);
        sessionRef.current = createEmptySession();
        return;
      }

      syncHighlight();
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
      stopHighlightLoop();
    };
  }, [enabled, startHighlightLoop, stopHighlightLoop, syncHighlight]);

  const speakWordRange = useCallback(
    (
      surfaceKey: string,
      sourceText: string,
      startIndex: number,
      endIndex: number,
    ) => {
      if (!enabled || loadingRef.current) {
        return;
      }

      const phraseText = phraseFromWordRange(sourceText, startIndex, endIndex);
      if (!phraseText.trim()) {
        return;
      }

      const requestId = Date.now();
      wordSynthRequestIdRef.current = requestId;
      loadingRef.current = true;
      setActiveSurfaceKey(surfaceKey);
      setWordLoading({ start: startIndex, end: endIndex });
      setWordHighlight(null);
      setPhraseRange(null);
      setError(null);

      sessionRef.current = {
        ...createEmptySession(),
        surfaceKey,
      };

      sendSpeakWordMessage({
        word: phraseText,
        wordIndex: startIndex,
        endWordIndex: endIndex,
        requestId,
      });
    },
    [enabled],
  );

  const getSurfaceState = useCallback(
    (surfaceKey: string): LibrarySurfaceState => {
      if (!enabled || activeSurfaceKey !== surfaceKey) {
        return idleSurfaceState;
      }

      return {
        highlight: wordHighlight,
        loading: wordLoading,
        phraseRange,
      };
    },
    [activeSurfaceKey, enabled, phraseRange, wordHighlight, wordLoading],
  );

  const displayError = enabled ? error : null;

  return {
    speakWordRange,
    getSurfaceState,
    error: displayError,
    resetPronunciation,
  };
}
