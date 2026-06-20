import { useCallback, useMemo, useRef } from "react";
import { OverlayHost } from "../../components/overlay/OverlayHost";
import { OverlayPanel } from "../../components/overlay/OverlayPanel";
import {
  CheckIcon,
  EditIcon,
  IconButton,
  PauseIcon,
  PlaybackStopIcon,
  RecordIcon,
  ResetIcon,
  SpeakerIcon,
  StopIcon,
} from "../../components/overlay/IconButton";
import {
  InteractiveWordText,
  PlainWordText,
} from "../../components/overlay/InteractiveWordText";
import { TranscriptEditor } from "../../components/overlay/TranscriptEditor";
import { TranscriptTranslationPanel } from "../../components/overlay/TranslationPanel";
import { useShadowMount } from "../../components/overlay/mount-shadow-react";
import { isShadowHostMounted } from "../../components/overlay/mount-shadow-react";
import { useAutoGrowRows } from "../../hooks/useAutoGrowRows";
import { useOverlayDismissals } from "../../hooks/useOverlayDismissals";
import { useTranscriptHostDrag } from "../../hooks/useOverlayDrag";
import { useTranscriptEditGuard } from "../../hooks/useTranscriptEditGuard";
import { isLearningTranslationSupported } from "../../utils/translation";
import { deriveStatusFromTranscriptView } from "../../utils/overlay-view-status";
import type { TranscriptOverlayViewState } from "./types";
import { transcriptHandlersRef } from "./types";
import {
  MAX_VISIBLE_TRANSCRIPT_LINES,
  WAITING_PLACEHOLDER,
} from "./types";
import {
  transcriptOverlayStore,
  useTranscriptOverlaySelector,
} from "./transcript-overlay-store";

const HOST_ID = "mot-transcript-overlay-host";

function getVisibleText(lines: string[], partial: string): string {
  const entries = [...lines];
  if (partial) {
    entries.push(partial);
  }

  if (entries.length === 0) {
    return "";
  }

  return entries.slice(-MAX_VISIBLE_TRANSCRIPT_LINES).join("\n");
}

function headerActivityForView(
  view: TranscriptOverlayViewState,
): "transcribing" | "paused" | "none" {
  if (view.kind === "streaming") {
    return "transcribing";
  }

  if (view.kind === "paused") {
    return "paused";
  }

  return "none";
}

function primaryActionForView(
  view: TranscriptOverlayViewState,
): "stop" | "resume" | "hidden" {
  if (view.kind === "streaming") {
    return "stop";
  }

  if (view.kind === "paused") {
    return "resume";
  }

  return "hidden";
}

function toolbarForView(view: TranscriptOverlayViewState) {
  if (view.kind === "streaming") {
    return { reset: true, edit: false };
  }

  if (view.kind === "paused") {
    return { reset: true, edit: true };
  }

  return { reset: false, edit: false };
}

export function TranscriptOverlay() {
  const visible = useTranscriptOverlaySelector((state) => state.visible);
  const view = useTranscriptOverlaySelector((state) => state.view);
  const editMode = useTranscriptOverlaySelector((state) => state.editMode);
  const editDraft = useTranscriptOverlaySelector((state) => state.editDraft);
  const translation = useTranscriptOverlaySelector((state) => state.translation);
  const wordHighlight = useTranscriptOverlaySelector(
    (state) => state.wordHighlight,
  );
  const phraseRange = useTranscriptOverlaySelector((state) => state.phraseRange);
  const wordLoading = useTranscriptOverlaySelector((state) => state.wordLoading);
  const playbackVisible = useTranscriptOverlaySelector(
    (state) => state.playbackVisible,
  );
  const showRealtimeTranslation = useTranscriptOverlaySelector(
    (state) => state.showRealtimeTranslation,
  );
  const statusMessage = useTranscriptOverlaySelector(
    (state) => state.statusMessage,
  );
  const statusError = useTranscriptOverlaySelector((state) => state.statusError);
  const handlersRef = useTranscriptOverlaySelector((state) => state.handlersRef);

  const hostRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const transcriptRef = useRef<HTMLElement | null>(null);
  const { host } = useShadowMount();
  const shadowHostRef = useRef<HTMLElement | null>(null);
  shadowHostRef.current = host;

  const { headerProps } = useTranscriptHostDrag(hostRef, headerRef);

  useTranscriptEditGuard(editMode);

  const onDismiss = useCallback(() => {
    handlersRef.current.onClose?.();
  }, [handlersRef]);

  useOverlayDismissals({
    hostRef: shadowHostRef,
    onDismiss,
    enabled: visible && view.kind !== "hidden",
    dismissOnOutsideClick: false,
    escapeCapture: true,
    escapeStopImmediate: true,
  });

  const lines =
    view.kind === "streaming" || view.kind === "paused" ? view.lines : [];
  const partial =
    view.kind === "streaming"
      ? view.partial
      : view.kind === "paused"
        ? (view.partial ?? "")
        : "";

  const visibleText = useMemo(
    () => getVisibleText(lines, partial),
    [lines, partial],
  );

  const transcriptRows = useAutoGrowRows(
    transcriptRef,
    visibleText,
    MAX_VISIBLE_TRANSCRIPT_LINES,
    editMode,
  );

  const transcriptRowAttr =
    transcriptRows > 1 ? String(transcriptRows) : undefined;

  const isReadMode = view.kind === "paused" && Boolean(handlersRef.current.onWordSelect);

  const derivedStatus = useMemo(
    () => deriveStatusFromTranscriptView(view),
    [view],
  );

  const displayStatusMessage = statusMessage ?? derivedStatus.message;
  const displayStatusError = statusError || derivedStatus.error;

  const toggleEditMode = useCallback(
    (enabled: boolean, applyEdits: boolean) => {
      const current = transcriptOverlayStore.getState();

      if (enabled && current.editMode) {
        return;
      }

      if (enabled) {
        transcriptHandlersRef.current.onStopPlayback?.();
        transcriptOverlayStore.setState({
          editMode: true,
          editDraft:
            visibleText === WAITING_PLACEHOLDER ? "" : visibleText,
          translation: { visible: false },
          wordHighlight: null,
          phraseRange: null,
          wordLoading: null,
          playbackVisible: false,
        });
        return;
      }

      const editedText = current.editDraft ?? "";
      transcriptOverlayStore.setState({
        editMode: false,
        editDraft: null,
      });

      if (current.editMode && applyEdits) {
        transcriptHandlersRef.current.onTranscriptEdited?.(editedText);
      }
    },
    [visibleText],
  );

  if (!visible || view.kind === "hidden") {
    return null;
  }

  const headerActivity = headerActivityForView(view);
  const primaryAction = primaryActionForView(view);
  const toolbar = toolbarForView(view);
  const showAllow =
    view.kind === "needs-capture" && Boolean(handlersRef.current.onAllowCapture);
  const showRealtimeTranslationToggle =
    isLearningTranslationSupported() &&
    (view.kind === "streaming" || view.kind === "paused");

  const displayText =
    editMode && editDraft !== null
      ? editDraft
      : visibleText || WAITING_PLACEHOLDER;

  const isPlaceholder = !editMode && !visibleText;

  return (
    <OverlayHost hostRef={hostRef} className="hostWrap">
      <OverlayPanel
        headerRef={headerRef}
        headerProps={headerProps}
        className="card transcriptCard"
        ariaLabel="Drag live transcript panel"
        onClose={handlersRef.current.onClose}
        headerLeft={
          <div className="headerLeft">
            <span
              className={`headerSpinner${headerActivity === "transcribing" ? " isVisible" : ""
                }`}
              aria-hidden="true"
            />
            <span
              className={`headerPause${headerActivity === "paused" ? " isVisible" : ""
                }`}
              aria-hidden="true"
            >
              <PauseIcon />
            </span>
            <p className="title">Live transcript</p>
          </div>
        }
      >
        <div className="transcriptBody">
          <TranscriptTranslationPanel state={translation} />

          {editMode ? (
            <TranscriptEditor
              value={editDraft ?? ""}
              onChange={(value) => {
                transcriptOverlayStore.setState({ editDraft: value });
              }}
              innerRef={transcriptRef}
              dataRows={String(MAX_VISIBLE_TRANSCRIPT_LINES)}
              maxRows={MAX_VISIBLE_TRANSCRIPT_LINES}
            />
          ) : isReadMode && visibleText ? (
            <InteractiveWordText
              text={visibleText}
              className={`transcript is-read-mode${isPlaceholder ? " isPlaceholder" : ""
                }`}
              dataRows={transcriptRowAttr}
              innerRef={transcriptRef}
              highlight={wordHighlight}
              phraseRange={phraseRange}
              loading={wordLoading}
              onWordSelect={handlersRef.current.onWordSelect}
            />
          ) : (
            <PlainWordText
              text={displayText}
              className={`transcript${isPlaceholder ? " isPlaceholder" : ""}`}
              dataRows={transcriptRowAttr}
              innerRef={transcriptRef}
            />
          )}
        </div>

        <div className="transcriptFooter">
          {displayStatusMessage ? (
            <p
              className={`status${displayStatusError ? " error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {displayStatusMessage}
            </p>
          ) : null}

          {showAllow ? (
            <button
              type="button"
              className="allowButton"
              onClick={() => handlersRef.current.onAllowCapture?.()}
            >
              Allow tab audio
            </button>
          ) : null}

          <div className="footerToolbar">
            <div className="footerToolbarLeft">
              <IconButton
                className="playbackBtn"
                hidden={!playbackVisible}
                label="Stop pronunciation"
                title="Stop pronunciation"
                onClick={(event) => {
                  event.stopPropagation();
                  handlersRef.current.onStopPlayback?.();
                }}
              >
                <span className="iconSpeaker">
                  <SpeakerIcon />
                </span>
                <span className="iconStop">
                  <PlaybackStopIcon />
                </span>
              </IconButton>

              {showRealtimeTranslationToggle ? (
                <label className="realtimeTranslationToggle">
                  <span className="realtimeTranslationToggleLabel">
                    Show real-time translation
                  </span>
                  <button
                    type="button"
                    role="switch"
                    className={`realtimeTranslationSwitch${showRealtimeTranslation ? " isOn" : ""
                      }`}
                    aria-checked={showRealtimeTranslation}
                    aria-label="Show real-time translation"
                    onClick={(event) => {
                      event.stopPropagation();
                      handlersRef.current.onToggleRealtimeTranslation?.(
                        !showRealtimeTranslation,
                      );
                    }}
                  />
                </label>
              ) : null}
            </div>

            <div className="footerToolbarActions">
              <IconButton
                hidden={!toolbar.reset}
                label="Reset transcript"
                title="Reset transcript"
                onClick={(event) => {
                  event.stopPropagation();
                  if (editMode) {
                    toggleEditMode(false, false);
                  }
                  handlersRef.current.onReset?.();
                }}
              >
                <ResetIcon />
              </IconButton>

              <IconButton
                hidden={!toolbar.edit}
                active={editMode}
                label={editMode ? "Done editing" : "Edit transcript"}
                title={editMode ? "Done editing" : "Edit transcript"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleEditMode(!editMode, true);
                }}
              >
                {editMode ? <CheckIcon /> : <EditIcon />}
              </IconButton>

              <IconButton
                className="transcriptTransportButton"
                hidden={primaryAction === "hidden"}
                label={
                  primaryAction === "resume"
                    ? "Resume transcription"
                    : "Stop transcription"
                }
                title={
                  primaryAction === "resume"
                    ? "Resume transcription"
                    : "Stop transcription"
                }
                onClick={(event) => {
                  event.stopPropagation();
                  if (primaryAction === "resume") {
                    handlersRef.current.onResume?.();
                    return;
                  }

                  handlersRef.current.onStop?.();
                }}
              >
                {primaryAction === "resume" ? <RecordIcon /> : <StopIcon />}
              </IconButton>
            </div>
          </div>
        </div>
      </OverlayPanel>
    </OverlayHost>
  );
}

export function isTranscriptOverlayMounted(): boolean {
  return isShadowHostMounted(HOST_ID);
}
