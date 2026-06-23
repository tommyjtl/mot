import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import { VocabEntryDetails } from "../../components/overlay/VocabEntryDetails";
import { OverlayHost } from "../../components/overlay/OverlayHost";
import { OverlayPanel } from "../../components/overlay/OverlayPanel";
import { TranslationPanel } from "../../components/overlay/TranslationPanel";
import { useOverlayDrag } from "../../hooks/useOverlayDrag";
import {
  addVocabContext,
  deleteVocabContext,
  updateVocabNote,
} from "../../utils/vocab/vocab-client";
import {
  computeTopRightPanelPosition,
  type PanelPosition,
} from "../../utils/overlay-layout";
import { closeWordOverlay } from "./word-overlay-controller";
import {
  WORD_OVERLAY_WIDTH,
  useWordOverlaySelector,
  wordOverlayStore,
} from "./word-overlay-store";

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

export function WordOverlay() {
  const open = useWordOverlaySelector((state) => state.open);
  const userMoved = useWordOverlaySelector((state) => state.userMoved);
  const position = useWordOverlaySelector((state) => state.position);
  const originalText = useWordOverlaySelector((state) => state.originalText);
  const translationText = useWordOverlaySelector((state) => state.translationText);
  const passageText = useWordOverlaySelector((state) => state.passageText);
  const entry = useWordOverlaySelector((state) => state.entry);
  const addingContext = useWordOverlaySelector((state) => state.addingContext);
  const deletingContextId = useWordOverlaySelector(
    (state) => state.deletingContextId,
  );
  const actionError = useWordOverlaySelector((state) => state.actionError);

  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const noteSaveTimerRef = useRef<number | null>(null);

  const { headerProps } = useOverlayDrag(panelRef, headerRef, {
    onDragStart: () => {
      if (!wordOverlayStore.getState().userMoved) {
        wordOverlayStore.setState({ userMoved: true });
      }
    },
    onDragEnd: (nextPosition) => {
      wordOverlayStore.setState({
        position: nextPosition,
        userMoved: true,
      });
    },
  });

  useEffect(() => {
    if (!open || userMoved || !panelRef.current) {
      return;
    }

    const panel = panelRef.current;
    const nextPosition = computeTopRightPanelPosition(
      WORD_OVERLAY_WIDTH,
      panel.offsetHeight || 200,
    );
    wordOverlayStore.setState({ position: nextPosition });
  }, [open, userMoved, originalText, entry?.contexts.length, entry?.note]);

  useEffect(
    () => () => {
      if (noteSaveTimerRef.current !== null) {
        window.clearTimeout(noteSaveTimerRef.current);
      }
    },
    [],
  );

  const persistNote = useCallback((note: string, normalized: string) => {
    if (noteSaveTimerRef.current !== null) {
      window.clearTimeout(noteSaveTimerRef.current);
    }

    noteSaveTimerRef.current = window.setTimeout(() => {
      noteSaveTimerRef.current = null;
      void updateVocabNote(normalized, note)
        .then((next) => {
          wordOverlayStore.setState({ entry: next });
        })
        .catch(() => {
          // Keep local edits even if persistence fails briefly.
        });
    }, 400);
  }, []);

  const handleNoteChange = useCallback(
    (note: string) => {
      const current = wordOverlayStore.getState().entry;
      if (!current) {
        return;
      }

      const next = { ...current, note };
      wordOverlayStore.setState({ entry: next });
      persistNote(note, current.normalized);
    },
    [persistNote],
  );

  const handleAddContext = useCallback(async () => {
    const state = wordOverlayStore.getState();
    if (!state.entry || !state.passageText.trim()) {
      return;
    }

    wordOverlayStore.setState({ addingContext: true, actionError: null });
    try {
      const next = await addVocabContext(state.entry.normalized, {
        sentence: state.passageText,
        url: window.location.href,
        pageTitle: document.title,
      });
      wordOverlayStore.setState({ entry: next });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not add context.";
      wordOverlayStore.setState({ actionError: message });
    } finally {
      wordOverlayStore.setState({ addingContext: false });
    }
  }, []);

  const handleDeleteContext = useCallback(async (contextId: string) => {
    const state = wordOverlayStore.getState();
    if (!state.entry) {
      return;
    }

    wordOverlayStore.setState({
      deletingContextId: contextId,
      actionError: null,
    });
    try {
      const next = await deleteVocabContext(state.entry.normalized, contextId);
      wordOverlayStore.setState({ entry: next });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not delete context.";
      wordOverlayStore.setState({ actionError: message });
    } finally {
      wordOverlayStore.setState({ deletingContextId: null });
    }
  }, []);

  if (!open || !entry) {
    return null;
  }

  const cardClassName = `card wordOverlayCard${position ? "" : " wordOverlayCardDefault"}`;

  return (
    <OverlayHost className="wordOverlayHost">
      <OverlayPanel
        panelRef={panelRef}
        headerRef={headerRef}
        headerProps={headerProps}
        className={cardClassName}
        style={panelStyle(position)}
        ariaLabel="Drag saved word panel"
        onClose={closeWordOverlay}
        showDragHandle
        headerLeft={<p className="headerTitle">Saved word</p>}
      >
        <div className="body wordOverlayBody">
          <TranslationPanel
            state={{
              visible: true,
              originalText,
              translationText,
              mode: "word",
            }}
            showRestore={false}
            showVocabAction={false}
          />
          <VocabEntryDetails
            entry={entry}
            contextText={passageText}
            addingContext={addingContext}
            deletingContextId={deletingContextId}
            onAddContext={() => void handleAddContext()}
            onDeleteContext={(contextId) => void handleDeleteContext(contextId)}
            onNoteChange={handleNoteChange}
          />
          {actionError ? (
            <p className="vocabActionError" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      </OverlayPanel>
    </OverlayHost>
  );
}
