import {
  getSettings,
  saveSettings,
  type Lang,
  type Voice,
} from "../../utils/settings";
import {
  getOffscreenModelStatus,
  warmUpOffscreenTts,
} from "../../utils/offscreen-tts";
import {
  getOffscreenSttStatus,
  warmUpOffscreenStt,
} from "../../utils/offscreen-stt";
import { isModelCached } from "../../utils/supertonic/model-cache";
import { isSttModelCached } from "../../utils/stt/model-cache";
import type { Message, ModelLoadBroadcastMessage } from "../../utils/messages";
import type { SttModelLoadBroadcast } from "../../utils/stt/model-load-broadcast";

const form = document.getElementById("settings-form") as HTMLFormElement;
const transcriptionForm = document.getElementById(
  "transcription-form",
) as HTMLFormElement;
const voiceSelect = document.getElementById("voice") as HTMLSelectElement;
const langSelect = document.getElementById("lang") as HTMLSelectElement;
const youtubeTranscriptSyncInput = document.getElementById(
  "youtube-transcript-sync",
) as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const transcriptionStatusEl = document.getElementById(
  "transcription-status",
) as HTMLParagraphElement;

const ttsModelIcon = document.getElementById(
  "tts-model-icon",
) as HTMLSpanElement;
const ttsModelStatus = document.getElementById(
  "tts-model-status",
) as HTMLParagraphElement;
const ttsModelProgress = document.getElementById(
  "tts-model-progress",
) as HTMLDivElement;
const ttsModelProgressFill = document.getElementById(
  "tts-model-progress-fill",
) as HTMLDivElement;

const sttModelIcon = document.getElementById(
  "stt-model-icon",
) as HTMLSpanElement;
const sttModelStatus = document.getElementById(
  "stt-model-status",
) as HTMLParagraphElement;
const sttModelProgress = document.getElementById(
  "stt-model-progress",
) as HTMLDivElement;
const sttModelProgressFill = document.getElementById(
  "stt-model-progress-fill",
) as HTMLDivElement;

const debugTranscriptionState = document.getElementById(
  "debug-transcription-state",
) as HTMLSpanElement;
const debugTargetTab = document.getElementById(
  "debug-target-tab",
) as HTMLSpanElement;
const debugOffscreenState = document.getElementById(
  "debug-offscreen-state",
) as HTMLSpanElement;

type TranscriptionStateResponse = {
  active: boolean;
  tabId: number | null;
  tabTitle?: string;
  tabUrl?: string;
  offscreenDocument: boolean;
};

type ModelCardState = "checking" | "loading" | "ready" | "error";

const warmupStarted = {
  tts: false,
  stt: false,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function queryWithRetry<T>(
  query: () => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await query();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await delay(120 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

function setModelCardIcon(icon: HTMLElement, state: ModelCardState): void {
  icon.className = "model-card-icon";

  if (state === "checking" || state === "loading") {
    icon.classList.add("is-spinner");
    return;
  }

  if (state === "ready") {
    icon.classList.add("is-ready");
    return;
  }

  if (state === "error") {
    icon.classList.add("is-error");
  }
}

function setModelCard(options: {
  icon: HTMLElement;
  status: HTMLElement;
  progress: HTMLElement;
  progressFill: HTMLElement;
  state: ModelCardState;
  detail: string;
  percent?: number;
}): void {
  const { icon, status, progress, progressFill, state, detail, percent } =
    options;

  status.textContent = detail;
  status.classList.toggle("is-ready", state === "ready");
  status.classList.toggle("is-error", state === "error");
  setModelCardIcon(icon, state);

  if (state === "loading" && typeof percent === "number") {
    progress.hidden = false;
    progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    return;
  }

  progress.hidden = true;
  progressFill.style.width = "0%";
}

function showTtsModel(
  state: ModelCardState,
  detail: string,
  percent?: number,
): void {
  setModelCard({
    icon: ttsModelIcon,
    status: ttsModelStatus,
    progress: ttsModelProgress,
    progressFill: ttsModelProgressFill,
    state,
    detail,
    percent,
  });
}

function showSttModel(
  state: ModelCardState,
  detail: string,
  percent?: number,
): void {
  setModelCard({
    icon: sttModelIcon,
    status: sttModelStatus,
    progress: sttModelProgress,
    progressFill: sttModelProgressFill,
    state,
    detail,
    percent,
  });
}

async function startTtsWarmupIfNeeded(): Promise<void> {
  if (warmupStarted.tts) {
    return;
  }

  warmupStarted.tts = true;
  try {
    await warmUpOffscreenTts();
  } catch {
    // Progress and errors arrive via runtime broadcasts.
  } finally {
    warmupStarted.tts = false;
  }
}

async function startSttWarmupIfNeeded(): Promise<void> {
  if (warmupStarted.stt) {
    return;
  }

  warmupStarted.stt = true;
  try {
    await warmUpOffscreenStt();
  } catch {
    // Progress and errors arrive via runtime broadcasts.
  } finally {
    warmupStarted.stt = false;
  }
}

async function refreshTtsModelStatus(): Promise<void> {
  showTtsModel("checking", "Checking text-to-speech model…");

  try {
    const status = await queryWithRetry(() => getOffscreenModelStatus());

    if (status === "ready") {
      showTtsModel(
        "ready",
        "Ready. Option+S will speak selected text instantly.",
      );
      return;
    }

    if (status === "loading") {
      showTtsModel("loading", "Loading text-to-speech model…", 0);
      return;
    }

    const cached = await isModelCached();
    showTtsModel(
      "loading",
      cached
        ? "Loading cached text-to-speech model…"
        : "Downloading text-to-speech model…",
      0,
    );
    void startTtsWarmupIfNeeded();
  } catch {
    showTtsModel(
      "error",
      "Could not reach the TTS worker. Reload the extension and try again.",
    );
  }
}

async function refreshSttModelStatus(): Promise<void> {
  showSttModel("checking", "Checking speech model…");

  try {
    const status = await queryWithRetry(() => getOffscreenSttStatus());

    if (status === "ready") {
      showSttModel(
        "ready",
        "Ready. Option+T transcribes audio from the active web page.",
      );
      return;
    }

    if (status === "transcribing") {
      showSttModel(
        "ready",
        "Ready. Transcription is active on a tab.",
      );
      return;
    }

    if (status === "loading") {
      showSttModel("loading", "Loading speech model…", 0);
      return;
    }

    const cached = await isSttModelCached();
    showSttModel(
      "loading",
      cached
        ? "Loading cached speech model…"
        : "Downloading speech model…",
      0,
    );
    void startSttWarmupIfNeeded();
  } catch {
    showSttModel(
      "error",
      "Could not reach the speech worker. Reload the extension and try again.",
    );
  }
}

function formatTargetTab(state: TranscriptionStateResponse): string {
  if (state.active && state.tabTitle) {
    return state.tabTitle;
  }

  if (state.tabUrl) {
    try {
      return new URL(state.tabUrl).hostname;
    } catch {
      return state.tabUrl;
    }
  }

  if (state.active) {
    return `Tab ${state.tabId ?? "?"}`;
  }

  return "None";
}

function updateTranscriptionSession(state: TranscriptionStateResponse): void {
  debugTranscriptionState.textContent = state.active ? "Active" : "Inactive";
  debugTargetTab.textContent = formatTargetTab(state);
  debugOffscreenState.textContent = state.offscreenDocument
    ? "Running"
    : "Not running";
}

async function refreshTranscriptionState(): Promise<void> {
  try {
    const state = (await queryWithRetry(() =>
      browser.runtime.sendMessage({
        type: "get-transcription-state",
      }),
    )) as TranscriptionStateResponse;
    updateTranscriptionSession(state);

    if (state.active) {
      showSttModel("ready", "Ready. Transcription is active on a tab.");
    }
  } catch {
    debugTranscriptionState.textContent = "Unavailable";
    debugTargetTab.textContent = "—";
    debugOffscreenState.textContent = "—";
  }
}

async function loadSettings(): Promise<void> {
  const settings = await getSettings();
  voiceSelect.value = settings.voice;
  langSelect.value = settings.lang;
  youtubeTranscriptSyncInput.checked = settings.youtubeTranscriptSync;
}

function showSavedStatus(target: HTMLParagraphElement): void {
  target.textContent = "Settings saved.";
  window.setTimeout(() => {
    target.textContent = "";
  }, 2000);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const voice = voiceSelect.value as Voice;
  const lang = langSelect.value as Lang;
  const current = await getSettings();

  await saveSettings({
    ...current,
    voice,
    lang,
  });

  showSavedStatus(statusEl);
});

transcriptionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const current = await getSettings();

  await saveSettings({
    ...current,
    youtubeTranscriptSync: youtubeTranscriptSyncInput.checked,
  });

  showSavedStatus(transcriptionStatusEl);
});

browser.runtime.onMessage.addListener(
  (message: ModelLoadBroadcastMessage | SttModelLoadBroadcast | Message) => {
    if (message.type === "model-load-progress") {
      if (message.phase === "loading-model") {
        showTtsModel("loading", message.detail, message.percent);
        return;
      }

      if (message.phase === "ready") {
        showTtsModel(
          "ready",
          message.detail ||
          "Ready. Option+S will speak selected text instantly.",
        );
        return;
      }

      if (message.phase === "error") {
        showTtsModel("error", message.detail);
      }
      return;
    }

    if (message.type === "stt-model-load-progress") {
      if (message.phase === "loading-model") {
        showSttModel("loading", message.detail, message.percent);
        return;
      }

      if (message.phase === "ready") {
        showSttModel(
          "ready",
          message.detail ||
          "Ready. Option+T transcribes audio from the active web page.",
        );
        return;
      }

      if (message.phase === "error") {
        showSttModel("error", message.detail);
      }
      return;
    }

    if (message.type === "transcription-state-changed") {
      void refreshTranscriptionState();

      if (message.active) {
        showSttModel("ready", "Ready. Transcription is active on a tab.");
      } else {
        void refreshSttModelStatus();
      }
    }
  },
);

void loadSettings();
void refreshTtsModelStatus();
void refreshSttModelStatus();
void refreshTranscriptionState();

window.setInterval(() => {
  void refreshTranscriptionState();
}, 4000);
