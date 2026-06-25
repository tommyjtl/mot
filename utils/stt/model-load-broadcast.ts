export type SttModelLoadBroadcast =
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
    };

export function broadcastSttModelLoadProgress(
  progress:
    | { phase: "loading-model"; detail: string; percent?: number }
    | { phase: "ready"; detail: string },
): void {
  const message: SttModelLoadBroadcast =
    progress.phase === "ready"
      ? {
          type: "stt-model-load-progress",
          phase: "ready",
          detail: progress.detail,
          percent: 100,
        }
      : {
          type: "stt-model-load-progress",
          phase: "loading-model",
          detail: progress.detail,
          percent: progress.percent ?? 0,
        };

  void browser.runtime.sendMessage(message).catch(() => {
    // No listeners yet — settings page or background may be closed.
  });
}

export function broadcastSttModelLoadError(detail: string): void {
  void browser.runtime
    .sendMessage({
      type: "stt-model-load-progress",
      phase: "error",
      detail,
    } satisfies SttModelLoadBroadcast)
    .catch(() => undefined);
}
