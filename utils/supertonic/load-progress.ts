import { INIT_SESSION_STEPS, MODEL_DOWNLOAD_TOTAL_BYTES } from "./asset-sizes";

const DOWNLOAD_SHARE = 0.88;
const INIT_SHARE = 0.1;
const VOICE_SHARE = 0.02;

export type ModelLoadProgress = {
  phase: "loading-model";
  detail: string;
  percent: number;
};

export class ModelLoadTracker {
  private downloadCompletedBytes = 0;
  private currentAssetBytes = 0;
  private currentAssetLoaded = 0;
  private initStep = 0;
  private initStepCount = INIT_SESSION_STEPS;
  private voiceLoaded = false;
  private finished = false;

  startAsset(path: string, byteSize: number): void {
    this.currentAssetBytes = byteSize;
    this.currentAssetLoaded = 0;
    this.currentDetail = shortAssetLabel(path);
  }

  updateAsset(loaded: number, total: number): void {
    this.currentAssetLoaded = loaded;
    this.currentAssetBytes = total > 0 ? total : this.currentAssetBytes;
  }

  completeAsset(byteSize: number): void {
    this.downloadCompletedBytes += byteSize;
    this.currentAssetLoaded = byteSize;
    this.currentAssetBytes = byteSize;
  }

  setInitStep(step: number, total: number, detail: string): void {
    this.initStep = step;
    this.initStepCount = total;
    this.currentDetail = detail;
  }

  markVoiceLoaded(): void {
    this.voiceLoaded = true;
    this.currentDetail = "Loading voice style…";
  }

  finish(): ModelLoadProgress {
    this.finished = true;
    return this.snapshot("Model ready", 100);
  }

  snapshot(detail?: string, percent?: number): ModelLoadProgress {
    return {
      phase: "loading-model",
      detail: detail ?? this.buildDetail(),
      percent: percent ?? this.computePercent(),
    };
  }

  private currentDetail = "Preparing…";

  private computePercent(): number {
    if (this.finished) {
      return 100;
    }

    const downloadRatio = Math.min(
      1,
      (this.downloadCompletedBytes + this.currentAssetLoaded) /
        Math.max(MODEL_DOWNLOAD_TOTAL_BYTES, 1),
    );
    const initRatio =
      this.initStepCount > 0 ? this.initStep / this.initStepCount : 0;

    const raw =
      downloadRatio * DOWNLOAD_SHARE +
      initRatio * INIT_SHARE +
      (this.voiceLoaded ? VOICE_SHARE : 0);

    return Math.min(99, Math.max(0, Math.round(raw * 100)));
  }

  private buildDetail(): string {
    return this.currentDetail;
  }
}

function shortAssetLabel(path: string): string {
  if (path.startsWith("voice_styles/")) {
    return `Downloading ${path.replace("voice_styles/", "")} voice…`;
  }

  const fileName = path.split("/").pop() ?? path;
  return `Downloading ${fileName.replace(/_/g, " ")}…`;
}

export function formatProgressLabel(detail: string, percent: number): string {
  return `${detail} ${percent}%`;
}
