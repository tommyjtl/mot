import { overlaySharedStyles } from "../../components/overlay/overlay-styles";
import {
  ensureShadowReactMount,
  getShadowReactMount,
} from "../../components/overlay/mount-shadow-react";
import wordOverlayCss from "./word-overlay.css?inline";
import { WordOverlay } from "./WordOverlay";

const HOST_ID = "mot-word-overlay-host";

export function mountWordOverlay(): void {
  if (getShadowReactMount(HOST_ID)) {
    return;
  }

  const existingHost = document.getElementById(HOST_ID);
  if (existingHost?.shadowRoot?.querySelector("#react-root")) {
    // Another content-script bundle already mounted the shared host.
    return;
  }

  ensureShadowReactMount({
    hostId: HOST_ID,
    App: WordOverlay,
    styles: [
      ...overlaySharedStyles,
      { key: "word-overlay", css: wordOverlayCss },
    ],
  });
}

export function isWordOverlayMounted(): boolean {
  return Boolean(document.getElementById(HOST_ID));
}
