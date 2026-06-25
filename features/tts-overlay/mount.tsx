import { overlaySharedStyles } from "../../components/overlay/overlay-styles";
import { ensureShadowReactMount } from "../../components/overlay/mount-shadow-react";
import { mountWordOverlay } from "../word-overlay/mount";
import ttsOverlayCss from "./tts-overlay.css?inline";
import { TtsOverlay } from "./TtsOverlay";

export function mountTtsOverlay(): void {
  ensureShadowReactMount({
    hostId: "mot-tts-overlay-host",
    App: TtsOverlay,
    styles: [
      ...overlaySharedStyles,
      { key: "tts-overlay", css: ttsOverlayCss },
    ],
  });
  mountWordOverlay();
}
