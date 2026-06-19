import type { SelectionResult } from "./selection";
import type { TtsAlignment } from "./tts-types";

export type SelectionRect = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
};

export type SelectionPayload = {
  text: string;
  rect: SelectionRect;
};

export type ModelLoadBroadcastMessage =
  | {
      type: "model-load-progress";
      phase: "loading-model";
      detail: string;
      percent: number;
    }
  | {
      type: "model-load-progress";
      phase: "ready";
      detail: string;
      percent: 100;
    }
  | {
      type: "model-load-progress";
      phase: "error";
      detail: string;
    };

export type Message =
  | { type: "speak-selection"; requestId: number }
  | { type: "selection-result"; requestId: number; result: SelectionResult }
  | {
      type: "tts-result";
      requestId: number;
      payload:
        | {
            ok: true;
            text: string;
            rect: SelectionRect;
            audioBase64: string;
            alignment?: TtsAlignment;
          }
        | {
            ok: false;
            text?: string;
            rect?: SelectionRect;
            error: string;
          };
    }
  | {
      type: "tts-progress";
      requestId: number;
      phase: "loading-model" | "generating";
      detail?: string;
      percent?: number;
    }
  | ModelLoadBroadcastMessage
  | { type: "stop-audio" }
  | { type: "play-audio"; audioBase64: string }
  | {
      type: "tts-playback";
      state: "playing" | "timeupdate" | "paused" | "ended";
      currentTime: number;
      duration: number;
    }
  | {
      type: "mot-playback-relay";
      tabId: number;
      state: "playing" | "timeupdate" | "paused" | "ended";
      currentTime: number;
      duration: number;
    }
  | { type: "session-idle" }
  | { type: "request-cancelled"; requestId: number }
  | {
      type: "speak-word";
      word: string;
      wordIndex: number;
      endWordIndex?: number;
      requestId: number;
    }
  | {
      type: "word-tts-result";
      requestId: number;
      wordIndex: number;
      endWordIndex?: number;
      payload:
        | {
            ok: true;
            word: string;
            audioBase64: string;
            alignment?: TtsAlignment;
          }
        | { ok: false; error: string };
    };
