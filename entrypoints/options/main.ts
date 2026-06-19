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
import type { ModelLoadBroadcastMessage } from "../../utils/messages";

const form = document.getElementById("settings-form") as HTMLFormElement;
const voiceSelect = document.getElementById("voice") as HTMLSelectElement;
const langSelect = document.getElementById("lang") as HTMLSelectElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const modelLoadCard = document.getElementById("model-load-card") as HTMLDivElement;
const modelReadyCard = document.getElementById("model-ready-card") as HTMLDivElement;
const modelLoadDetail = document.getElementById("model-load-detail") as HTMLParagraphElement;
const modelProgressFill = document.getElementById("model-progress-fill") as HTMLDivElement;

function showModelLoading(detail: string, percent?: number): void {
  modelLoadCard.hidden = false;
  modelReadyCard.hidden = true;
  modelLoadDetail.textContent = detail;
  if (typeof percent === "number") {
    modelProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

function showModelReady(detail = "Model ready. Option+S will speak instantly."): void {
  modelLoadCard.hidden = true;
  modelReadyCard.hidden = false;
  modelReadyCard.querySelector("p")!.textContent = detail;
}

async function refreshModelStatus(): Promise<void> {
  try {
    const status = await getOffscreenModelStatus();
    if (status === "ready") {
      showModelReady();
      return;
    }

    if (status === "loading") {
      showModelLoading("Loading model…", 0);
      return;
    }

    showModelLoading("Preparing to download model…", 0);
    void warmUpOffscreenTts();
  } catch {
    showModelLoading("Could not reach the TTS worker. Reload the extension and try again.");
  }
}

async function loadSettings(): Promise<void> {
  const settings = await getSettings();
  voiceSelect.value = settings.voice;
  langSelect.value = settings.lang;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const voice = voiceSelect.value as Voice;
  const lang = langSelect.value as Lang;

  await saveSettings({ voice, lang });

  statusEl.textContent = "Settings saved.";
  window.setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
});

browser.runtime.onMessage.addListener((message: ModelLoadBroadcastMessage) => {
  if (message.type !== "model-load-progress") {
    return;
  }

  if (message.phase === "loading-model") {
    showModelLoading(message.detail, message.percent);
    return;
  }

  if (message.phase === "ready") {
    showModelReady(message.detail);
    return;
  }

  if (message.phase === "error") {
    showModelLoading(message.detail);
  }
});

void loadSettings();
void refreshModelStatus();
