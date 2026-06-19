import type { Lang, Voice } from "../settings";
import type { TtsAlignment } from "../tts-types";
import { DEFAULT_SPEED, DEFAULT_TOTAL_STEPS } from "./constants";
import { isModelCached } from "./model-cache";
import {
  loadTextToSpeech,
  loadVoiceStyle,
  type ModelLoadProgress,
} from "./loader";
import { Style, TextToSpeech } from "./text-to-speech";
import { writeWavFile } from "./wav";

const DEFAULT_VOICE: Voice = "F1";

export type TtsProgress =
  | ModelLoadProgress
  | { phase: "generating"; detail?: string; percent?: number };

export type LocalSynthesisResult = {
  audio: ArrayBuffer;
  text: string;
  alignment: TtsAlignment;
  durationSeconds: number;
};

export class TtsEngineError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "TtsEngineError";
  }
}

type EngineState = {
  tts: TextToSpeech;
  voice: Voice;
  style: Style;
};

type ProgressListener = (progress: TtsProgress) => void;

let loadPromise: Promise<TextToSpeech> | null = null;
let engineState: EngineState | null = null;
let progressListeners = new Set<ProgressListener>();

function notifyProgress(progress: TtsProgress): void {
  for (const listener of progressListeners) {
    listener(progress);
  }
}

export function subscribeTtsProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export async function getEngineStatus(): Promise<"ready" | "loading" | "idle"> {
  if (engineState) {
    return "ready";
  }
  if (loadPromise) {
    return "loading";
  }
  if (await isModelCached()) {
    return "idle";
  }
  return "idle";
}

export async function warmUpTtsEngine(
  onProgress?: (progress: TtsProgress) => void,
): Promise<void> {
  await ensureEngine(DEFAULT_VOICE, onProgress);
}

async function ensureTextToSpeech(
  onProgress?: (progress: TtsProgress) => void,
): Promise<TextToSpeech> {
  if (engineState) {
    return engineState.tts;
  }

  if (!loadPromise) {
    loadPromise = loadTextToSpeech((progress) => {
      notifyProgress(progress);
    }).catch((error) => {
      loadPromise = null;
      throw error;
    });
  }

  let unsubscribe: (() => void) | undefined;
  if (onProgress) {
    unsubscribe = subscribeTtsProgress((progress) => {
      onProgress(progress);
    });
  }

  try {
    return await loadPromise;
  } catch (error) {
    loadPromise = null;
    throw error;
  } finally {
    unsubscribe?.();
  }
}

async function ensureEngine(
  voice: Voice,
  onProgress?: (progress: TtsProgress) => void,
): Promise<EngineState> {
  if (engineState && engineState.voice === voice) {
    return engineState;
  }

  const tts = await ensureTextToSpeech(onProgress);

  if (!engineState || engineState.voice !== voice) {
    const voiceProgress = (progress: ModelLoadProgress): void => {
      notifyProgress(progress);
      onProgress?.(progress);
    };

    if (engineState && engineState.voice !== voice) {
      voiceProgress({
        phase: "loading-model",
        detail: `Loading voice ${voice}… 99%`,
        percent: 99,
      });
    }

    const style = await loadVoiceStyle(voice, voiceProgress);
    engineState = { tts, voice, style };
  }

  return engineState;
}

export async function synthesizeLocally(
  options: {
    text: string;
    voice: Voice;
    lang: Lang;
    signal?: AbortSignal;
  },
  onProgress?: (progress: TtsProgress) => void,
): Promise<LocalSynthesisResult> {
  const { text, voice, lang, signal } = options;
  throwIfAborted(signal);

  const engine = await ensureEngine(voice, onProgress);
  throwIfAborted(signal);

  const generating = { phase: "generating" as const, detail: "Generating pronunciation…" };
  notifyProgress(generating);
  onProgress?.(generating);

  const result = await engine.tts.callWithAlignment(
    text,
    lang,
    engine.style,
    DEFAULT_TOTAL_STEPS,
    DEFAULT_SPEED,
  );

  throwIfAborted(signal);

  const trimmedLength = Math.floor(engine.tts.sampleRate * result.durationSeconds);
  const wavOut = result.wav.slice(0, trimmedLength);

  return {
    audio: writeWavFile(wavOut, engine.tts.sampleRate),
    text: result.displayText,
    alignment: result.alignment,
    durationSeconds: result.durationSeconds,
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Synthesis aborted", "AbortError");
  }
}

export function resetTtsEngine(): void {
  engineState = null;
  loadPromise = null;
}
