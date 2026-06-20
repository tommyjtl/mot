import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  getShadowReactMount,
  isShadowHostMounted,
} from "../../components/overlay/mount-shadow-react";
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
import { TranscriptTranslationPanel } from "../../components/overlay/TranslationPanel";
import { useTranscriptHostDrag } from "../../hooks/useOverlayDrag";
import { isLearningTranslationSupported } from "../../utils/translation";
import {
  MAX_VISIBLE_TRANSCRIPT_LINES,
  WAITING_PLACEHOLDER,
} from "./types";
import {
  transcriptOverlayStore,
  useTranscriptOverlayStore,
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
  view: ReturnType<typeof useTranscriptOverlayStore>["view"],
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
  view: ReturnType<typeof useTranscriptOverlayStore>["view"],
): "stop" | "resume" | "hidden" {
  if (view.kind === "streaming") {
    return "stop";
  }

  if (view.kind === "paused") {
    return "resume";
  }

  return "hidden";
}

function toolbarForView(view: ReturnType<typeof useTranscriptOverlayStore>["view"]) {
  if (view.kind === "streaming") {
    return { reset: true, edit: false };
  }

  if (view.kind === "paused") {
    return { reset: true, edit: true };
  }

  return { reset: false, edit: false };
}

export function TranscriptOverlay() {
  const state = useTranscriptOverlayStore();
  const hostRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const transcriptRef = useRef<HTMLElement | null>(null);
  const [transcriptRows, setTranscriptRows] = useState(1);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const { headerProps } = useTranscriptHostDrag(hostRef, headerRef);

  const setTranscriptRowCount = useCallback((rows: number) => {
    const clamped = Math.max(1, Math.min(MAX_VISIBLE_TRANSCRIPT_LINES, rows));
    setTranscriptRows(clamped);
  }, []);

  const transcriptRowAttr =
    transcriptRows > 1 ? String(transcriptRows) : undefined;

  useEffect(() => {
    shadowRootRef.current = getShadowReactMount(HOST_ID)?.shadow ?? null;
  }, []);

  const lines =
    state.view.kind === "streaming" || state.view.kind === "paused"
      ? state.view.lines
      : [];
  const partial =
    state.view.kind === "streaming"
      ? state.view.partial
      : state.view.kind === "paused"
        ? (state.view.partial ?? "")
        : "";

  const visibleText = useMemo(
    () => getVisibleText(lines, partial),
    [lines, partial],
  );

  const isReadMode =
    state.view.kind === "paused" && Boolean(state.handlers.onWordSelect);

  const applyTranscriptLayout = useCallback(() => {
    const transcriptEl = transcriptRef.current;
    if (!transcriptEl || state.editMode) {
      return;
    }

    const overflows = transcriptEl.scrollHeight > transcriptEl.clientHeight + 1;

    if (transcriptRows < MAX_VISIBLE_TRANSCRIPT_LINES && overflows) {
      setTranscriptRowCount(transcriptRows + 1);
      requestAnimationFrame(() => {
        if (transcriptRef.current) {
          transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
      });
      return;
    }

    if (transcriptRows >= 2 && overflows) {
      transcriptEl.scrollTop = transcriptEl.scrollHeight;
    }
  }, [setTranscriptRowCount, state.editMode, transcriptRows]);

  useEffect(() => {
    if (state.editMode) {
      return;
    }

    if (!visibleText) {
      setTranscriptRowCount(1);
    }

    requestAnimationFrame(() => {
      applyTranscriptLayout();
      requestAnimationFrame(applyTranscriptLayout);
    });
  }, [visibleText, state.view.kind, state.editMode, applyTranscriptLayout, setTranscriptRowCount]);

  useEffect(() => {
    const host = document.getElementById(HOST_ID);
    if (!host) {
      return;
    }

    if (state.editMode) {
      host.dataset.transcriptEdit = "true";
    } else {
      delete host.dataset.transcriptEdit;
    }
  }, [state.editMode]);

  useEffect(() => {
    const transcriptEl = transcriptRef.current;
    if (!transcriptEl || !state.editMode) {
      return;
    }

    const isolateKeyEvent = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        return;
      }

      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const onPaste = (event: ClipboardEvent): void => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!text) {
        return;
      }

      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      selection.deleteFromDocument();
      selection.getRangeAt(0).insertNode(document.createTextNode(text));
      selection.collapseToEnd();
    };

    transcriptEl.addEventListener("keydown", isolateKeyEvent, true);
    transcriptEl.addEventListener("keyup", isolateKeyEvent, true);
    transcriptEl.addEventListener("paste", onPaste);

    return () => {
      transcriptEl.removeEventListener("keydown", isolateKeyEvent, true);
      transcriptEl.removeEventListener("keyup", isolateKeyEvent, true);
      transcriptEl.removeEventListener("paste", onPaste);
    };
  }, [state.editMode]);

  const toggleEditMode = useCallback(
    (enabled: boolean, applyEdits: boolean) => {
      const current = transcriptOverlayStore.getState();

      if (enabled && current.editMode) {
        return;
      }

      if (enabled) {
        current.handlers.onStopPlayback?.();
        transcriptOverlayStore.setState({
          editMode: true,
          editDraft:
            visibleText === WAITING_PLACEHOLDER ? "" : visibleText,
          translation: { visible: false },
          wordHighlight: null,
          wordLoading: null,
          playbackVisible: false,
        });
        return;
      }

      const editedText = transcriptRef.current?.textContent ?? "";
      transcriptOverlayStore.setState({
        editMode: false,
        editDraft: null,
      });

      if (current.editMode && applyEdits) {
        current.handlers.onTranscriptEdited?.(editedText);
      }
    },
    [visibleText],
  );

  useEffect(() => {
    if (!state.editMode) {
      return;
    }

    const el = transcriptRef.current;
    if (!el) {
      return;
    }

    el.textContent = state.editDraft ?? "";
    requestAnimationFrame(() => {
      applyTranscriptLayout();
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      applyTranscriptLayout();
    });
  }, [state.editMode, state.editDraft, applyTranscriptLayout]);

  if (!state.visible || state.view.kind === "hidden") {
    return null;
  }

  const headerActivity = headerActivityForView(state.view);
  const primaryAction = primaryActionForView(state.view);
  const toolbar = toolbarForView(state.view);
  const showAllow =
    state.view.kind === "needs-capture" && Boolean(state.handlers.onAllowCapture);
  const showRealtimeTranslationToggle =
    isLearningTranslationSupported() &&
    (state.view.kind === "streaming" || state.view.kind === "paused");

  const displayText =
    state.editMode && state.editDraft !== null
      ? state.editDraft
      : visibleText || WAITING_PLACEHOLDER;

  const isPlaceholder = !state.editMode && !visibleText;

  return (
    <div ref={hostRef} className="hostWrap">
      <div className="card transcriptCard">
        <header
          ref={headerRef}
          className="header"
          aria-label="Drag live transcript panel"
          {...headerProps}
        >
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
          <div className="headerActions">
            <button
              type="button"
              className="closeButton"
              aria-label="Close"
              title="Close"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                state.handlers.onClose?.();
              }}
            >
              ×
            </button>
          </div>
        </header>

        <div className="transcriptBody">
          <TranscriptTranslationPanel state={state.translation} />

          {state.editMode ? (
            <div
              ref={(node) => {
                transcriptRef.current = node;
              }}
              className="transcript isEditing"
              data-rows={String(MAX_VISIBLE_TRANSCRIPT_LINES)}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Live transcript"
            />
          ) : isReadMode && visibleText ? (
            <InteractiveWordText
              text={visibleText}
              className={`transcript is-read-mode${isPlaceholder ? " isPlaceholder" : ""
                }`}
              dataRows={transcriptRowAttr}
              innerRef={transcriptRef}
              shadowRootRef={shadowRootRef}
              highlight={state.wordHighlight}
              loading={state.wordLoading}
              onWordSelect={state.handlers.onWordSelect}
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
          {state.statusMessage ? (
            <p
              className={`status${state.statusError ? " error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {state.statusMessage}
            </p>
          ) : null}

          {showAllow ? (
            <button
              type="button"
              className="allowButton"
              onClick={() => state.handlers.onAllowCapture?.()}
            >
              Allow tab audio
            </button>
          ) : null}

          <div className="footerToolbar">
            <div className="footerToolbarLeft">
              <IconButton
                className="playbackBtn"
                hidden={!state.playbackVisible}
                label="Stop pronunciation"
                title="Stop pronunciation"
                onClick={(event) => {
                  event.stopPropagation();
                  state.handlers.onStopPlayback?.();
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
                    className={`realtimeTranslationSwitch${state.showRealtimeTranslation ? " isOn" : ""
                      }`}
                    aria-checked={state.showRealtimeTranslation}
                    aria-label="Show real-time translation"
                    onClick={(event) => {
                      event.stopPropagation();
                      state.handlers.onToggleRealtimeTranslation?.(
                        !state.showRealtimeTranslation,
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
                  if (state.editMode) {
                    toggleEditMode(false, false);
                  }
                  state.handlers.onReset?.();
                }}
              >
                <ResetIcon />
              </IconButton>

              <IconButton
                hidden={!toolbar.edit}
                active={state.editMode}
                label={state.editMode ? "Done editing" : "Edit transcript"}
                title={state.editMode ? "Done editing" : "Edit transcript"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleEditMode(!state.editMode, true);
                }}
              >
                {state.editMode ? <CheckIcon /> : <EditIcon />}
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
                    state.handlers.onResume?.();
                    return;
                  }

                  state.handlers.onStop?.();
                }}
              >
                {primaryAction === "resume" ? <RecordIcon /> : <StopIcon />}
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function isTranscriptOverlayMounted(): boolean {
  return isShadowHostMounted(HOST_ID);
}
