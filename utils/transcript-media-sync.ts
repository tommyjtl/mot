import type { MediaPlaybackEventDetail } from "./media-playback-sync";

export type TranscriptPauseSource = "none" | "user" | "media";

export function createTranscriptMediaSyncController(deps: {
  isTranscribing: () => boolean;
  pauseFromMedia: () => void;
  resumeFromMedia: () => void;
}) {
  let pauseSource: TranscriptPauseSource = "none";
  let pendingMediaResume = false;
  let enabled = false;

  return {
    setEnabled(next: boolean): void {
      enabled = next;
      if (!enabled) {
        pauseSource = "none";
        pendingMediaResume = false;
      }
    },

    getPauseSource(): TranscriptPauseSource {
      return pauseSource;
    },

    reset(): void {
      pauseSource = "none";
      pendingMediaResume = false;
    },

    pauseFromUser(): void {
      pauseSource = "user";
      pendingMediaResume = false;
    },

    resumeFromUser(): void {
      pauseSource = "none";
      pendingMediaResume = false;
    },

    onTranscriptStopped(): void {
      if (!enabled || !pendingMediaResume || pauseSource !== "media") {
        return;
      }

      pendingMediaResume = false;
      pauseSource = "none";
      deps.resumeFromMedia();
    },

    handleMediaPlayback(detail: MediaPlaybackEventDetail): void {
      if (!enabled) {
        return;
      }

      if (detail.state === "playing") {
        if (pauseSource !== "media") {
          return;
        }

        if (deps.isTranscribing()) {
          pendingMediaResume = true;
          return;
        }

        pendingMediaResume = false;
        pauseSource = "none";
        deps.resumeFromMedia();
        return;
      }

      if (detail.state === "paused" || detail.state === "ended") {
        if (!deps.isTranscribing()) {
          return;
        }

        pauseSource = "media";
        pendingMediaResume = false;
        deps.pauseFromMedia();
      }
    },
  };
}

export type TranscriptMediaSyncController = ReturnType<
  typeof createTranscriptMediaSyncController
>;
