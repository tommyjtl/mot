import overlayBaseCss from "../../components/overlay/overlay-base.css?inline";
import { ensureShadowReactMount } from "../../components/overlay/mount-shadow-react";
import wordOverlayCss from "./word-overlay.css?inline";
import { WordOverlay } from "./WordOverlay";

const HOST_ID = "mot-word-overlay-host";

export function mountWordOverlay(): void {
  if (document.getElementById(HOST_ID)) {
    return;
  }

  ensureShadowReactMount({
    hostId: HOST_ID,
    App: WordOverlay,
    styles: [
      { key: "overlay-base", css: overlayBaseCss },
      { key: "word-overlay", css: wordOverlayCss },
    ],
  });
}

export function isWordOverlayMounted(): boolean {
  return Boolean(document.getElementById(HOST_ID));
}
