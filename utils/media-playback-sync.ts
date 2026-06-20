export type MediaPlaybackState = "playing" | "paused" | "ended";

export const MEDIA_PLAYBACK_EVENT = "mot-media-playback";

export type MediaPlaybackEventDetail = {
  state: MediaPlaybackState;
};

export function dispatchMediaPlaybackState(state: MediaPlaybackState): void {
  document.dispatchEvent(
    new CustomEvent<MediaPlaybackEventDetail>(MEDIA_PLAYBACK_EVENT, {
      detail: { state },
    }),
  );
}
