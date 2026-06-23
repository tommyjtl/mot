import overlayBaseCss from "../../components/overlay/overlay-base.css?inline";
import { ensureShadowReactMount } from "../../components/overlay/mount-shadow-react";
import { mountWordOverlay } from "../word-overlay/mount";
import transcriptOverlayCss from "./transcript-overlay.css?inline";
import { TranscriptOverlay } from "./TranscriptOverlay";

export function mountTranscriptOverlay(): void {
  ensureShadowReactMount({
    hostId: "mot-transcript-overlay-host",
    App: TranscriptOverlay,
    styles: [
      { key: "overlay-base", css: overlayBaseCss },
      { key: "transcript-overlay", css: transcriptOverlayCss },
    ],
  });
  mountWordOverlay();
}
