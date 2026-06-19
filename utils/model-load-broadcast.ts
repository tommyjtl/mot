import type { ModelLoadProgress } from "./supertonic/load-progress";

export type ModelLoadBroadcast =
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

export function broadcastModelLoadProgress(
  progress: ModelLoadProgress | { phase: "ready"; detail: string },
): void {
  const message: ModelLoadBroadcast =
    progress.phase === "ready"
      ? {
          type: "model-load-progress",
          phase: "ready",
          detail: progress.detail,
          percent: 100,
        }
      : {
          type: "model-load-progress",
          phase: "loading-model",
          detail: progress.detail,
          percent: progress.percent,
        };

  void browser.runtime.sendMessage(message).catch(() => {
    // No listeners yet — settings page or background may be closed.
  });
}

export function broadcastModelLoadError(detail: string): void {
  void browser.runtime
    .sendMessage({
      type: "model-load-progress",
      phase: "error",
      detail,
    } satisfies ModelLoadBroadcast)
    .catch(() => undefined);
}
