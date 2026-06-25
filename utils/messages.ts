import type { SelectionResult } from "./selection";
import type { TtsAlignment } from "./tts-types";
import type { ViewportCaptureSelection } from "./capture-region";
import type {
  VocabContextInput,
  VocabCreateInput,
  VocabExport,
} from "./vocab/types";

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
    phase: "loading-model" | "generating" | "recognizing";
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
  }
  | { type: "start-capture-mode"; requestId: number }
  | {
    type: "capture-region-selected";
    requestId: number;
    selection: ViewportCaptureSelection | null;
  }
  | {
    type: "ocr-started";
    requestId: number;
    rect: SelectionRect;
    detail?: string;
  }
  | { type: "transcript-started" }
  | { type: "transcript-stopped" }
  | {
    type: "transcript-status";
    text: string;
    ready: boolean;
    progress?: { loaded: number; total: number };
    percent?: number;
  }
  | { type: "transcript-chunk"; text: string; isFinal: boolean }
  | { type: "transcript-error"; message: string }
  | { type: "stop-transcription" }
  | { type: "dismiss-transcription" }
  | { type: "start-transcription-gesture" }
  | { type: "start-transcription-with-stream"; streamId: string; tabId: number }
  | {
    type: "transcript-request-capture";
    tabId: number;
    message?: string;
    preserveLines?: boolean;
  }
  | {
    type: "stt-transcript-status-relay";
    tabId: number;
    text: string;
    ready: boolean;
    progress?: { loaded: number; total: number };
    percent?: number;
  }
  | {
    type: "stt-transcript-relay";
    tabId: number;
    text: string;
    isFinal: boolean;
  }
  | {
    type: "stt-transcript-error-relay";
    tabId: number;
    message: string;
  }
  | {
    type: "stt-model-load-progress";
    phase: "loading-model";
    detail: string;
    percent: number;
  }
  | {
    type: "stt-model-load-progress";
    phase: "ready";
    detail: string;
    percent: 100;
  }
  | {
    type: "stt-model-load-progress";
    phase: "error";
    detail: string;
  }
  | { type: "speak-selection-gesture" }
  | { type: "transcribe-command-gesture" }
  | { type: "toggle-transcription" }
  | { type: "get-transcription-state" }
  | {
    type: "transcription-state-changed";
    active: boolean;
    tabId: number | null;
    tabTitle?: string;
    tabUrl?: string;
    error?: string;
  }
  | { type: "vocab-lookup"; original: string }
  | { type: "vocab-create"; payload: VocabCreateInput }
  | {
    type: "vocab-add-context";
    normalized: string;
    context: VocabContextInput;
  }
  | { type: "vocab-update-note"; normalized: string; note: string }
  | { type: "vocab-delete-context"; normalized: string; contextId: string }
  | { type: "vocab-export" }
  | { type: "vocab-import"; data: VocabExport };
