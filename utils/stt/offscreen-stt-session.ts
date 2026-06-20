import { sttAssetUrl, sttRuntimeBaseUrl } from "./constants";
import {
  formatSttStatusText,
  sttDownloadPercent,
  sttOverallDownloadPercent,
} from "./load-progress";
import {
  broadcastSttModelLoadError,
  broadcastSttModelLoadProgress,
} from "./model-load-broadcast";

export type SttEngineStatus = "idle" | "loading" | "ready" | "transcribing";

type SttClientInstance = {
  init(): Promise<void>;
  startStream(stream: MediaStream): Promise<void>;
  stopRecording(): void;
  abortCapture(): void;
  waitUntilStopped(): Promise<void>;
  destroy(): void;
  reset(): void;
  isReady(): boolean;
  isCapturing(): boolean;
};

type SttClientConstructor = new (options: {
  baseUrl?: string;
  workerUrl?: string;
  audioProcessorUrl?: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onStatus?: (
    text: string,
    ready: boolean,
    progress?: { loaded: number; total: number },
  ) => void;
  onError?: (error: Error) => void;
}) => SttClientInstance;

let client: SttClientInstance | null = null;
let clientInitPromise: Promise<void> | null = null;
let activeTabId: number | null = null;
let pendingInitTabId: number | null = null;
let sessionStream: MediaStream | null = null;
let sessionGeneration = 0;
let sessionChain: Promise<void> = Promise.resolve();
let SttClientClass: SttClientConstructor | null = null;

function stopStreamTracks(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function abortCaptureImmediately(): void {
  stopStreamTracks(sessionStream);
  sessionStream = null;

  if (client?.isReady()) {
    client.abortCapture();
  }
}

function resetWorkerSession(): void {
  if (client?.isReady()) {
    client.reset();
  }
}

function isSessionCurrent(generation: number): boolean {
  return generation === sessionGeneration;
}

function enqueueSession<T>(task: () => Promise<T>): Promise<T> {
  const next = sessionChain.then(task, task);
  sessionChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function shouldRelayStatusToTab(text: string, ready: boolean): boolean {
  const normalized = text.trim().toLowerCase();

  if (normalized.startsWith("processing")) {
    return false;
  }

  if (normalized === "ready" && ready) {
    return false;
  }

  return true;
}

async function loadSttClientClass(): Promise<SttClientConstructor> {
  if (SttClientClass) {
    return SttClientClass;
  }

  const moduleUrl = sttAssetUrl("stt-client.js");
  const module = (await import(/* @vite-ignore */ moduleUrl)) as {
    SttClient: SttClientConstructor;
  };
  SttClientClass = module.SttClient;
  return SttClientClass;
}

function publishSttStatus(
  text: string,
  ready: boolean,
  progress?: { loaded: number; total: number },
): { detail: string; percent?: number } {
  const detail = formatSttStatusText(text);
  const filePercent = sttDownloadPercent(progress);
  const percent =
    filePercent ??
    (progress?.loaded ? sttOverallDownloadPercent(progress) : undefined);

  if (ready) {
    const normalized = detail.trim().toLowerCase();
    if (!normalized.startsWith("listening")) {
      broadcastSttModelLoadProgress({
        phase: "ready",
        detail: "Speech model ready. Option+T transcribes tab audio.",
      });
    }
  } else {
    const normalized = detail.trim().toLowerCase();
    const isSessionStatus =
      normalized.startsWith("stopped") ||
      normalized.startsWith("processing") ||
      normalized.startsWith("updating transcript") ||
      normalized.startsWith("listening") ||
      normalized.startsWith("connecting to tab audio") ||
      normalized.includes("capturing tab audio");

    if (!isSessionStatus) {
      broadcastSttModelLoadProgress({
        phase: "loading-model",
        detail,
        percent: percent ?? 0,
      });
    }
  }

  return { detail, percent };
}

function relayStatus(
  tabId: number | null,
  text: string,
  ready: boolean,
  progress?: { loaded: number; total: number },
): void {
  const { detail, percent } = publishSttStatus(text, ready, progress);

  if (tabId === null || !shouldRelayStatusToTab(text, ready)) {
    return;
  }

  void browser.runtime
    .sendMessage({
      type: "stt-transcript-status-relay",
      tabId,
      text: detail,
      ready,
      progress,
      percent,
    })
    .catch(() => {
      // Background may be unavailable during reload.
    });
}

function relayTranscript(tabId: number, text: string, isFinal: boolean): void {
  void browser.runtime
    .sendMessage({
      type: "stt-transcript-relay",
      tabId,
      text,
      isFinal,
    })
    .catch(() => {
      // Background may be unavailable during reload.
    });
}

function relayError(tabId: number, message: string): void {
  void browser.runtime
    .sendMessage({
      type: "stt-transcript-error-relay",
      tabId,
      message,
    })
    .catch(() => {
      // Background may be unavailable during reload.
    });
}

async function ensureClient(tabId: number | null): Promise<SttClientInstance> {
  if (client?.isReady()) {
    return client;
  }

  if (clientInitPromise) {
    await clientInitPromise;
    if (client?.isReady()) {
      return client;
    }
  }

  pendingInitTabId = tabId;

  const SttClient = await loadSttClientClass();
  const baseUrl = sttRuntimeBaseUrl();

  client = new SttClient({
    baseUrl,
    workerUrl: sttAssetUrl("worker.js"),
    audioProcessorUrl: sttAssetUrl("audio-processor.js"),
    onTranscript: (text, isFinal) => {
      if (activeTabId !== null) {
        relayTranscript(activeTabId, text, isFinal);
      }
    },
    onStatus: (text, ready, progress) => {
      const relayTabId = activeTabId ?? pendingInitTabId;
      relayStatus(relayTabId, text, ready, progress);
    },
    onError: (error) => {
      broadcastSttModelLoadError(error.message);
      if (activeTabId !== null) {
        relayError(activeTabId, error.message);
      }
    },
  });

  clientInitPromise = client.init();
  relayStatus(tabId, "Loading speech model…", false);
  await clientInitPromise;
  clientInitPromise = null;
  pendingInitTabId = null;
  return client;
}

async function releaseTabAudioSession(): Promise<void> {
  abortCaptureImmediately();
  resetWorkerSession();
}

export function getSttEngineStatus(): SttEngineStatus {
  if (activeTabId !== null && client?.isReady()) {
    return "transcribing";
  }

  if (clientInitPromise) {
    return "loading";
  }

  if (client?.isReady()) {
    return "ready";
  }

  return "idle";
}

export function isTranscriptionActive(): boolean {
  return activeTabId !== null;
}

export function transcriptionTabId(): number | null {
  return activeTabId;
}

export async function warmUpSttEngine(): Promise<void> {
  if (client?.isReady()) {
    broadcastSttModelLoadProgress({
      phase: "ready",
      detail: "Speech model ready. Option+T transcribes tab audio.",
    });
    return;
  }

  try {
    await ensureClient(null);
    broadcastSttModelLoadProgress({
      phase: "ready",
      detail: "Speech model ready. Option+T transcribes tab audio.",
    });
  } catch (error: unknown) {
    const detail =
      error instanceof Error ? error.message : "Speech model failed to load";
    broadcastSttModelLoadError(detail);
    throw error;
  }
}

async function captureTabAudioStream(streamId: string): Promise<MediaStream> {
  const constraints = {
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  };

  const timeoutMs = 10_000;

  try {
    return await Promise.race([
      navigator.mediaDevices.getUserMedia(
        constraints as MediaStreamConstraints,
      ),
      new Promise<MediaStream>((_resolve, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              "Tab audio capture timed out. Press Option+T again while this tab is focused.",
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } catch (error: unknown) {
    const name = error instanceof DOMException ? error.name : "";
    const message = error instanceof Error ? error.message : String(error);

    if (name === "NotAllowedError" || /permission|denied/i.test(message)) {
      throw new Error(
        "Tab audio capture was denied. Reload the extension if this persists, then press Option+T on the page with audio.",
      );
    }

    if (/invalid|expired|not found|bad|not available/i.test(message)) {
      throw new Error(
        "Tab audio capture expired or is unavailable. Stop transcription, then press Option+T again while this tab is focused.",
      );
    }

    throw error instanceof Error ? error : new Error(message);
  }
}

export async function startTabTranscription(
  streamId: string,
  tabId: number,
): Promise<void> {
  return enqueueSession(async () => {
    const generation = ++sessionGeneration;

    // Sync cleanup only — must not delay getUserMedia or the stream id expires.
    abortCaptureImmediately();
    resetWorkerSession();

    activeTabId = tabId;

    let stream: MediaStream;
    try {
      stream = await captureTabAudioStream(streamId);
    } catch (error: unknown) {
      activeTabId = null;
      abortCaptureImmediately();
      const message =
        error instanceof Error ? error.message : "Tab audio capture failed.";
      relayError(tabId, message);
      throw error instanceof Error ? error : new Error(message);
    }

    if (!isSessionCurrent(generation)) {
      stopStreamTracks(stream);
      activeTabId = null;
      return;
    }

    sessionStream = stream;

    relayStatus(tabId, "Capturing tab audio…", false);

    let stt: SttClientInstance;
    try {
      stt = await ensureClient(tabId);
    } catch (error: unknown) {
      activeTabId = null;
      abortCaptureImmediately();
      const message =
        error instanceof Error ? error.message : "Transcription failed to start.";
      relayError(tabId, message);
      throw error instanceof Error ? error : new Error(message);
    }

    if (!isSessionCurrent(generation)) {
      activeTabId = null;
      abortCaptureImmediately();
      return;
    }

    try {
      await stt.startStream(stream);
      sessionStream = null;
      relayStatus(tabId, "Listening…", true);
    } catch (error: unknown) {
      activeTabId = null;
      abortCaptureImmediately();
      resetWorkerSession();
      const message =
        error instanceof Error ? error.message : "Transcription failed to start.";
      relayError(tabId, message);
      throw error instanceof Error ? error : new Error(message);
    }
  });
}

export async function stopTabTranscription(): Promise<void> {
  return enqueueSession(async () => {
    sessionGeneration += 1;
    const tabId = activeTabId;
    activeTabId = null;

    // Release Chrome tab capture immediately so audio can be recaptured on resume.
    // Live text is already in the overlay — skip flush.
    abortCaptureImmediately();
    resetWorkerSession();

    if (tabId !== null) {
      relayStatus(tabId, "Stopped", false);
    }
  });
}

export async function cancelTabTranscription(): Promise<void> {
  return enqueueSession(async () => {
    sessionGeneration += 1;
    const tabId = activeTabId;
    activeTabId = null;
    abortCaptureImmediately();
    resetWorkerSession();

    if (tabId !== null) {
      relayStatus(tabId, "Stopped", false);
    }
  });
}

export async function destroySttClient(): Promise<void> {
  return enqueueSession(async () => {
    activeTabId = null;
    pendingInitTabId = null;
    clientInitPromise = null;
    await releaseTabAudioSession();

    if (!client) {
      return;
    }

    client.destroy();
    client = null;
  });
}
