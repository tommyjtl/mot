import {
  dispatchMediaPlaybackState,
  type MediaPlaybackState,
} from "../utils/media-playback-sync";
import {
  DEFAULT_SETTINGS,
  getSettings,
  type MotSettings,
} from "../utils/settings";

const REBIND_DELAY_MS = 500;

let syncEnabled = DEFAULT_SETTINGS.youtubeTranscriptSync;
let boundVideo: HTMLVideoElement | null = null;
let lastUrl = location.href;
let rebindTimer: ReturnType<typeof setTimeout> | null = null;

function findMainVideo(): HTMLVideoElement | null {
  return (
    document.querySelector("video.html5-main-video") ??
    document.querySelector("#movie_player video") ??
    document.querySelector("ytd-shorts video") ??
    document.querySelector("video")
  );
}

function emitPlaybackState(state: MediaPlaybackState): void {
  if (!syncEnabled) {
    return;
  }

  dispatchMediaPlaybackState(state);
}

function onPlay(): void {
  emitPlaybackState("playing");
}

function onPause(): void {
  emitPlaybackState("paused");
}

function onEnded(): void {
  emitPlaybackState("ended");
}

function unbindVideo(): void {
  if (!boundVideo) {
    return;
  }

  boundVideo.removeEventListener("play", onPlay);
  boundVideo.removeEventListener("pause", onPause);
  boundVideo.removeEventListener("ended", onEnded);
  boundVideo = null;
}

function bindVideo(video: HTMLVideoElement): void {
  if (boundVideo === video) {
    return;
  }

  unbindVideo();
  boundVideo = video;
  video.addEventListener("play", onPlay);
  video.addEventListener("pause", onPause);
  video.addEventListener("ended", onEnded);
}

function bindVideoWhenReady(): void {
  const video = findMainVideo();
  if (video) {
    bindVideo(video);
  }
}

function scheduleRebind(): void {
  if (rebindTimer !== null) {
    clearTimeout(rebindTimer);
  }

  rebindTimer = setTimeout(() => {
    rebindTimer = null;
    unbindVideo();
    bindVideoWhenReady();
  }, REBIND_DELAY_MS);
}

function handleNavigation(): void {
  if (location.href === lastUrl) {
    return;
  }

  lastUrl = location.href;
  scheduleRebind();
}

function applySettings(settings: MotSettings): void {
  syncEnabled = settings.youtubeTranscriptSync;
}

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  runAt: "document_idle",

  main() {
    void getSettings().then(applySettings);

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" && areaName !== "local") {
        return;
      }

      const update = changes.motSettings?.newValue as Partial<MotSettings> | undefined;
      if (update?.youtubeTranscriptSync !== undefined) {
        syncEnabled = update.youtubeTranscriptSync;
      }
    });

    bindVideoWhenReady();

    const observer = new MutationObserver(() => {
      handleNavigation();

      if (!boundVideo || !document.contains(boundVideo)) {
        scheduleRebind();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    window.addEventListener(
      "pagehide",
      () => {
        observer.disconnect();
        if (rebindTimer !== null) {
          clearTimeout(rebindTimer);
        }
        unbindVideo();
      },
      { once: true },
    );
  },
});
