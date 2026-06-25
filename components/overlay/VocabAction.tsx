import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  createVocabEntry,
  lookupVocabEntry,
} from "../../utils/vocab/vocab-client";
import type { VocabEntry } from "../../utils/vocab/types";
import {
  isWordOverlayOpenFor,
  openWordOverlay,
} from "../../features/word-overlay/word-overlay-controller";
import { mountWordOverlay } from "../../features/word-overlay/mount";
import { useWordOverlaySelector } from "../../features/word-overlay/word-overlay-store";
import { GoToIcon, IconButton, PlusIcon } from "./IconButton";

type VocabActionProps = {
  originalText: string;
  translationText: string;
  contextText: string;
};

export function VocabAction({
  originalText,
  translationText,
  contextText,
}: VocabActionProps) {
  const lookupRequestRef = useRef(0);
  const [entry, setEntry] = useState<VocabEntry | null>(null);
  const [rowBusy, setRowBusy] = useState(false);
  const [actionErrorState, setActionErrorState] = useState<{
    forText: string;
    message: string;
  } | null>(null);
  const actionError =
    actionErrorState?.forText === originalText
      ? actionErrorState.message
      : null;
  const wordOverlayOpen = useWordOverlaySelector((state) => state.open);
  const isActive =
    wordOverlayOpen && isWordOverlayOpenFor(originalText);

  useEffect(() => {
    mountWordOverlay();
  }, []);

  useEffect(() => {
    const requestId = lookupRequestRef.current + 1;
    lookupRequestRef.current = requestId;

    void lookupVocabEntry(originalText)
      .then((found) => {
        if (lookupRequestRef.current !== requestId) {
          return;
        }

        setEntry(found);
      })
      .catch(() => {
        if (lookupRequestRef.current !== requestId) {
          return;
        }

        setEntry(null);
      });
  }, [originalText]);

  const handleOpenOverlay = useCallback(
    (savedEntry: VocabEntry) => {
      mountWordOverlay();
      openWordOverlay({
        originalText,
        translationText,
        passageText: contextText,
        entry: savedEntry,
      });
    },
    [contextText, originalText, translationText],
  );

  const handleCreate = useCallback(async () => {
    setRowBusy(true);
    setActionErrorState(null);
    try {
      const saved = await createVocabEntry({
        original: originalText,
        translation: translationText,
        context: {
          sentence: contextText,
          url: window.location.href,
          pageTitle: document.title,
        },
      });
      setEntry(saved);
      handleOpenOverlay(saved);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not save to vocabulary.";
      setActionErrorState({ forText: originalText, message });
    } finally {
      setRowBusy(false);
    }
  }, [contextText, handleOpenOverlay, originalText, translationText]);

  const handleRowClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setActionErrorState(null);

      if (entry) {
        handleOpenOverlay(entry);
        return;
      }

      void handleCreate();
    },
    [entry, handleCreate, handleOpenOverlay],
  );

  const rowLabel = entry ? "Open saved vocabulary entry" : "Save to vocabulary";

  return (
    <div className="vocabActionRoot">
      <IconButton
        label={rowLabel}
        title={rowLabel}
        className="vocabRowAction"
        active={isActive}
        onClick={handleRowClick}
      >
        {rowBusy ? (
          <span className="inlineSpinner" aria-hidden="true" />
        ) : entry ? (
          <GoToIcon />
        ) : (
          <PlusIcon />
        )}
      </IconButton>
      {actionError ? (
        <p className="vocabActionError vocabActionErrorInline" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
