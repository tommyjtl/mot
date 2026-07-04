import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { OverlayHost } from "../../components/overlay/OverlayHost";
import { OverlayPanel } from "../../components/overlay/OverlayPanel";
import {
  InteractiveWordText,
  PlainWordText,
} from "../../components/overlay/InteractiveWordText";
import { StatusFooter } from "../../components/overlay/StatusFooter";
import { TranslationPanel } from "../../components/overlay/TranslationPanel";
import { useShadowMount } from "../../components/overlay/mount-shadow-react";
import { isShadowHostMounted } from "../../components/overlay/mount-shadow-react";
import { useOverlayDismissals } from "../../hooks/useOverlayDismissals";
import { useOverlayDrag } from "../../hooks/useOverlayDrag";
import {
  computeCardPositionNearSelection,
  type PanelPosition,
} from "../../utils/overlay-layout";
import { isCaptureOverlayVisible } from "../../utils/capture-region";
import { deriveStatusFromTtsView } from "../../utils/overlay-view-status";
import { AlignmentDebugPanel } from "./AlignmentDebugPanel";
import {
  ttsOverlayStore,
  useTtsOverlaySelector,
} from "./tts-overlay-store";

const HOST_ID = "mot-tts-overlay-host";

function panelStyle(position: PanelPosition | null): CSSProperties | undefined {
  if (!position) {
    return undefined;
  }

  return {
    position: "fixed",
    left: position.left,
    top: position.top,
    right: "auto",
    bottom: "auto",
    transform: "none",
  };
}

export function TtsOverlay() {
  const visible = useTtsOverlaySelector((state) => state.visible);
  const view = useTtsOverlaySelector((state) => state.view);
  const selectionRect = useTtsOverlaySelector((state) => state.selectionRect);
  const userMoved = useTtsOverlaySelector((state) => state.userMoved);
  const position = useTtsOverlaySelector((state) => state.position);
  const translation = useTtsOverlaySelector((state) => state.translation);
  const wordHighlight = useTtsOverlaySelector((state) => state.wordHighlight);
  const phraseRange = useTtsOverlaySelector((state) => state.phraseRange);
  const wordLoading = useTtsOverlaySelector((state) => state.wordLoading);
  const statusMessage = useTtsOverlaySelector((state) => state.statusMessage);
  const loadingPhase = useTtsOverlaySelector((state) => state.loadingPhase);
  const loadingDetail = useTtsOverlaySelector((state) => state.loadingDetail);
  const loadingPercent = useTtsOverlaySelector((state) => state.loadingPercent);
  const handlersRef = useTtsOverlaySelector((state) => state.handlersRef);

  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const { host } = useShadowMount();
  const hostRef = useRef<HTMLElement | null>(null);
  hostRef.current = host;

  const onDismiss = useCallback(() => {
    handlersRef.current.onClose?.();
  }, [handlersRef]);

  useOverlayDismissals({
    hostRef,
    onDismiss,
    enabled: visible && view.kind !== "hidden",
    ignoreCaptureOverlay: isCaptureOverlayVisible,
  });

  const { headerProps } = useOverlayDrag(cardRef, headerRef, {
    onDragStart: () => {
      if (!ttsOverlayStore.getState().userMoved) {
        ttsOverlayStore.setState({ userMoved: true });
      }
    },
    onDragEnd: (nextPosition) => {
      ttsOverlayStore.setState({
        position: nextPosition,
        userMoved: true,
      });
    },
  });

  useEffect(() => {
    if (!visible || userMoved || !cardRef.current) {
      return;
    }

    const card = cardRef.current;
    const panelSize = {
      width: card.offsetWidth || 280,
      height: card.offsetHeight || 80,
    };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const nextPosition = selectionRect
      ? computeCardPositionNearSelection(selectionRect, panelSize, viewport)
      : null;

    ttsOverlayStore.setState({ position: nextPosition });
  }, [visible, selectionRect, userMoved, view.kind]);

  const derivedStatus = useMemo(
    () => deriveStatusFromTtsView(view),
    [view],
  );

  if (!visible || view.kind === "hidden") {
    return null;
  }

  const showTranslation = translation.visible && view.kind === "ready";
  const cardClassName = `card ttsCard${position ? "" : " ttsCardDefault"}`;

  return (
    <OverlayHost className="ttsHost">
      <OverlayPanel
        panelRef={cardRef}
        headerRef={headerRef}
        headerProps={headerProps}
        className={cardClassName}
        style={panelStyle(position)}
        ariaLabel="Drag pronunciation panel"
        onClose={() => handlersRef.current.onClose?.()}
        showDragHandle
      >
        <div className="body">
          {showTranslation ? (
            <TranslationPanel
              state={translation}
              passageText={view.kind === "ready" ? view.text : undefined}
              singleWordVocabInFullMode
              onRestore={() => handlersRef.current.onRestoreFullTranslation?.()}
            />
          ) : null}

          {view.kind === "ready" ? (
            <InteractiveWordText
              text={view.text}
              highlight={wordHighlight}
              phraseRange={phraseRange}
              loading={wordLoading}
              onWordSelect={handlersRef.current.onWordSelect}
            />
          ) : (
            <PlainWordText
              text={
                view.kind === "error"
                  ? (view.text ?? "")
                  : view.kind === "loading-model" || view.kind === "generating"
                    ? view.text
                    : ""
              }
            />
          )}

          <div className="footer">
            {view.kind === "ready" ? (
              <div className="actions">
                <button
                  type="button"
                  className={`actionButton${view.playback === "playing" ? " isPlaying" : ""
                    }`}
                  onClick={() => handlersRef.current.onTogglePlayback?.()}
                >
                  {view.playback === "playing"
                    ? "Stop pronunciation"
                    : "Listen"}
                </button>
              </div>
            ) : null}

            {view.kind === "loading-model" ||
              view.kind === "generating" ||
              loadingPhase ? (
              <StatusFooter
                loadingPhase={
                  loadingPhase ??
                  (view.kind === "generating" ? "generating" : "loading-model")
                }
                loadingDetail={
                  loadingDetail ??
                  (view.kind === "loading-model" || view.kind === "generating"
                    ? view.detail
                    : undefined)
                }
                loadingPercent={
                  loadingPercent ??
                  (view.kind === "loading-model" ? view.percent : undefined)
                }
              />
            ) : view.kind === "ready" ? (
              <StatusFooter
                message={
                  statusMessage ??
                  view.hint ??
                  "Click or drag across words to hear them."
                }
              />
            ) : view.kind === "error" ? (
              <StatusFooter
                message={derivedStatus.message ?? view.message}
                error
                actionLabel={
                  (derivedStatus.message ?? view.message)?.includes("Motif Options")
                    ? "Open Motif Options"
                    : undefined
                }
                onAction={
                  (derivedStatus.message ?? view.message)?.includes("Motif Options")
                    ? () => void browser.runtime.openOptionsPage()
                    : undefined
                }
              />
            ) : null}

            <AlignmentDebugPanel />
          </div>
        </div>
      </OverlayPanel>
    </OverlayHost>
  );
}

export function isTtsOverlayVisible(): boolean {
  return isShadowHostMounted(HOST_ID);
}
