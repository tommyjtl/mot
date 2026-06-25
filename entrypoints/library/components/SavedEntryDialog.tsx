import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Trash2Icon } from "lucide-react";
import {
  formatContextHost,
  formatSavedDate,
} from "@/components/vocab/vocab-format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { InteractiveWordText } from "@/components/overlay/InteractiveWordText";
import {
  deleteVocabContext,
  deleteVocabEntry,
  updateVocabNote,
} from "@/utils/vocab/vocab-client";
import type { VocabEntry } from "@/utils/vocab/types";
import { findContextTermWordRanges } from "@/utils/vocab/context-highlight";
import { contextWordSurfaceKey } from "@/utils/overlay-word-surface";
import { useWordSurfacePronunciation } from "@/hooks/useWordSurfacePronunciation";
import { SavedEntryDefinition } from "./SavedEntryDefinition";

const ORIGINAL_SURFACE = "original";

type SavedEntryDialogProps = {
  entry: VocabEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntryChange: (entry: VocabEntry) => void;
  onEntryDeleted: (normalized: string) => void;
};

export function SavedEntryDialog({
  entry,
  open,
  onOpenChange,
  onEntryChange,
  onEntryDeleted,
}: SavedEntryDialogProps) {
  const noteId = useId();
  const noteSaveTimerRef = useRef<number | null>(null);
  const entryKey = entry?.normalized ?? null;
  const [draftEntry, setDraftEntry] = useState<VocabEntry | null>(null);
  const localEntry =
    draftEntry?.normalized === entryKey ? draftEntry : entry;
  const [deletingContextId, setDeletingContextId] = useState<string | null>(null);
  const [dialogUi, setDialogUi] = useState<{
    forKey: string | null;
    actionError: string | null;
    showDeleteConfirm: boolean;
  }>({ forKey: null, actionError: null, showDeleteConfirm: false });
  const actionError =
    dialogUi.forKey === entryKey ? dialogUi.actionError : null;
  const showDeleteConfirm =
    dialogUi.forKey === entryKey ? dialogUi.showDeleteConfirm : false;
  const [deletingEntry, setDeletingEntry] = useState(false);

  const {
    speakWordRange,
    getSurfaceState,
    error: pronunciationError,
    resetPronunciation,
  } = useWordSurfacePronunciation(open && Boolean(localEntry));

  const originalState = getSurfaceState(ORIGINAL_SURFACE);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetPronunciation();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetPronunciation],
  );

  useEffect(
    () => () => {
      if (noteSaveTimerRef.current !== null) {
        window.clearTimeout(noteSaveTimerRef.current);
      }
    },
    [],
  );

  const persistNote = useCallback(
    (note: string, normalized: string) => {
      if (noteSaveTimerRef.current !== null) {
        window.clearTimeout(noteSaveTimerRef.current);
      }

      noteSaveTimerRef.current = window.setTimeout(() => {
        noteSaveTimerRef.current = null;
        void updateVocabNote(normalized, note)
          .then((next) => {
            setDraftEntry(next);
            onEntryChange(next);
          })
          .catch(() => {
            // Keep local edits even if persistence fails briefly.
          });
      }, 400);
    },
    [onEntryChange],
  );

  const handleNoteChange = useCallback(
    (note: string) => {
      if (!localEntry) {
        return;
      }

      const next = { ...localEntry, note };
      setDraftEntry(next);
      persistNote(note, localEntry.normalized);
    },
    [localEntry, persistNote],
  );

  const handleDeleteContext = useCallback(
    async (contextId: string) => {
      if (!localEntry) {
        return;
      }

      setDeletingContextId(contextId);
      setDialogUi((ui) => ({ ...ui, forKey: entryKey, actionError: null }));
      try {
        const next = await deleteVocabContext(localEntry.normalized, contextId);
        setDraftEntry(next);
        onEntryChange(next);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Could not delete context.";
        setDialogUi((ui) => ({
          ...ui,
          forKey: entryKey,
          actionError: message,
        }));
      } finally {
        setDeletingContextId(null);
      }
    },
    [localEntry, entryKey, onEntryChange],
  );

  const handleDeleteEntry = useCallback(async () => {
    if (!localEntry) {
      return;
    }

    setDeletingEntry(true);
    setDialogUi((ui) => ({ ...ui, forKey: entryKey, actionError: null }));
    try {
      await deleteVocabEntry(localEntry.normalized);
      onEntryDeleted(localEntry.normalized);
      handleDialogOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Could not remove saved item.";
      setDialogUi((ui) => ({
        ...ui,
        forKey: entryKey,
        actionError: message,
      }));
    } finally {
      setDeletingEntry(false);
      setDialogUi((ui) => ({
        ...ui,
        forKey: entryKey,
        showDeleteConfirm: false,
      }));
    }
  }, [entryKey, handleDialogOpenChange, localEntry, onEntryDeleted]);

  if (!localEntry) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-balance">Saved</DialogTitle>
          <DialogDescription className="sr-only">
            Details for {localEntry.original}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                Original
              </p>
              <InteractiveWordText
                text={localEntry.original}
                className="libraryWordText"
                highlight={originalState.highlight}
                loading={originalState.loading}
                phraseRange={originalState.phraseRange}
                onWordSelect={(startIndex, endIndex) =>
                  speakWordRange(
                    ORIGINAL_SURFACE,
                    localEntry.original,
                    startIndex,
                    endIndex,
                  )
                }
              />
            </div>

            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                Translation
              </p>
              <p className="libraryTranslationText">{localEntry.translation}</p>
            </div>
          </div>

          <Separator />

          <SavedEntryDefinition original={localEntry.original} />

          <div className="flex flex-col gap-2">
            <p className="m-0 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              Contexts
              {localEntry.contexts.length
                ? ` (${localEntry.contexts.length})`
                : ""}
            </p>
            {localEntry.contexts.length ? (
              <ul className="m-0 space-y-2 p-0">
                {[...localEntry.contexts].reverse().map((context) => {
                  const surfaceKey = contextWordSurfaceKey(context.id);
                  const contextState = getSurfaceState(surfaceKey);

                  return (
                  <li
                    key={context.id}
                    className="group rounded-md bg-muted px-3 pt-2 pb-1"
                  >
                    <InteractiveWordText
                      text={context.sentence}
                      className="libraryContextText"
                      highlight={contextState.highlight}
                      loading={contextState.loading}
                      phraseRange={contextState.phraseRange}
                      savedTermRanges={findContextTermWordRanges(
                        context.sentence,
                        localEntry.original,
                      )}
                      onWordSelect={(startIndex, endIndex) =>
                        speakWordRange(
                          surfaceKey,
                          context.sentence,
                          startIndex,
                          endIndex,
                        )
                      }
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] leading-[1.4] text-gray-400">
                        {formatSavedDate(context.addedAt)}
                        {context.url ? (
                          <>
                            {" · "}
                            <a
                              className="underline-offset-2 hover:underline"
                              href={context.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={context.url}
                            >
                              {formatContextHost(context.url)}
                            </a>
                          </>
                        ) : null}
                      </p>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[opacity,colors] hover:bg-accent hover:text-foreground focus-visible:opacity-100",
                          deletingContextId === context.id
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100",
                        )}
                        aria-label="Delete context"
                        title="Delete context"
                        onClick={() => void handleDeleteContext(context.id)}
                      >
                        {deletingContextId === context.id ? (
                          <span
                            className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
                            aria-hidden="true"
                          />
                        ) : (
                          <Trash2Icon className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No contexts saved yet.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="m-0 block text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground"
              htmlFor={noteId}
            >
              Note
            </label>
            <textarea
              id={noteId}
              className="mt-0 min-h-[84px] w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              rows={3}
              value={localEntry.note}
              placeholder="Add a note to help you remember this word…"
              onChange={(event) => handleNoteChange(event.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[13px] leading-[1.4] text-gray-400">
              Saved {formatSavedDate(localEntry.createdAt)}
            </p>
            {!showDeleteConfirm ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  setDialogUi((ui) => ({
                    ...ui,
                    forKey: entryKey,
                    showDeleteConfirm: true,
                  }))
                }
              >
                Remove
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDialogUi((ui) => ({
                      ...ui,
                      forKey: entryKey,
                      showDeleteConfirm: false,
                    }))
                  }
                  disabled={deletingEntry}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void handleDeleteEntry()}
                  disabled={deletingEntry}
                >
                  {deletingEntry ? "Removing…" : "Confirm remove"}
                </Button>
              </div>
            )}
          </div>

          {actionError || pronunciationError ? (
            <p className="text-sm text-destructive" role="alert">
              {actionError ?? pronunciationError}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
