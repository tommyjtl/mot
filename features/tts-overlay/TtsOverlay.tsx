import { useEffect, useRef } from "react";
import {
  getShadowReactMount,
  isShadowHostMounted,
} from "../../components/overlay/mount-shadow-react";
import { InteractiveWordText, PlainWordText } from "../../components/overlay/InteractiveWordText";
import { StatusFooter } from "../../components/overlay/StatusFooter";
import { TranslationPanel } from "../../components/overlay/TranslationPanel";
import {
  placeCardDefault,
  positionCardNearSelection,
  useOverlayDrag,
} from "../../hooks/useOverlayDrag";
import { AlignmentDebugPanel } from "./AlignmentDebugPanel";
import { useTtsOverlayStore, ttsOverlayStore } from "./tts-overlay-store";

const HOST_ID = "mot-tts-overlay-host";

export function TtsOverlay() {
  const state = useTtsOverlayStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const { headerProps } = useOverlayDrag(cardRef, headerRef, {
    onDragStart: () => {
      if (!ttsOverlayStore.getState().userMoved) {
        ttsOverlayStore.setState({ userMoved: true });
      }
    },
  });

  useEffect(() => {
    shadowRootRef.current = getShadowReactMount(HOST_ID)?.shadow ?? null;
  }, []);

  useEffect(() => {
    if (!state.visible || state.userMoved || !cardRef.current) {
      return;
    }

    if (state.selectionRect) {
      positionCardNearSelection(cardRef.current, state.selectionRect);
      return;
    }

    placeCardDefault(cardRef.current);
  }, [state.visible, state.selectionRect, state.userMoved, state.view.kind]);

  if (!state.visible || state.view.kind === "hidden") {
    return null;
  }

  const view = state.view;
  const showTranslation =
    state.translation.visible && view.kind === "ready";

  return (
    <div className="ttsHost">
      <div ref={cardRef} className="card ttsCard">
        <header
          ref={headerRef}
          className="header"
          aria-label="Drag pronunciation panel"
          {...headerProps}
        >
          <div className="dragHandle" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <button
            type="button"
            className="closeButton closeButton"
            aria-label="Close"
            title="Close"
            onClick={() => state.handlers.onClose?.()}
          >
            ×
          </button>
        </header>
        <div className="body">
          {showTranslation ? (
            <TranslationPanel
              state={state.translation}
              onRestore={state.handlers.onRestoreFullTranslation}
            />
          ) : null}

          {view.kind === "ready" ? (
            <InteractiveWordText
              text={view.text}
              shadowRootRef={shadowRootRef}
              highlight={state.wordHighlight}
              loading={state.wordLoading}
              onWordSelect={state.handlers.onWordSelect}
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
                  className={`actionButton${
                    view.playback === "playing" ? " isPlaying" : ""
                  }`}
                  onClick={() => state.handlers.onTogglePlayback?.()}
                >
                  {view.playback === "playing"
                    ? "Stop pronunciation"
                    : "Listen"}
                </button>
              </div>
            ) : null}

            {view.kind === "loading-model" ||
            view.kind === "generating" ||
            state.loadingPhase ? (
              <StatusFooter
                loadingPhase={
                  state.loadingPhase ??
                  (view.kind === "generating" ? "generating" : "loading-model")
                }
                loadingDetail={
                  state.loadingDetail ??
                  (view.kind === "loading-model" || view.kind === "generating"
                    ? view.detail
                    : undefined)
                }
                loadingPercent={
                  state.loadingPercent ??
                  (view.kind === "loading-model" ? view.percent : undefined)
                }
              />
            ) : view.kind === "ready" ? (
              <StatusFooter message={state.statusMessage ?? view.hint ?? "Click or drag across words to hear them."} />
            ) : view.kind === "error" ? (
              <StatusFooter message={view.message} error />
            ) : null}

            <AlignmentDebugPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export function isTtsOverlayVisible(): boolean {
  return isShadowHostMounted(HOST_ID);
}
