import { useId } from "react";
import type { VocabEntry } from "../../utils/vocab/types";
import {
  formatContextHost,
  formatSavedDate,
} from "../vocab/vocab-format";
import { findContextTermWordRanges } from "../../utils/vocab/context-highlight";
import { openLibraryTab } from "../../utils/open-library";
import { InteractiveWordText } from "./InteractiveWordText";
import type { WordSurfaceState } from "../../hooks/useWordSurfacePronunciation";
import { IconButton, PlusIcon, TrashIcon } from "./IconButton";

type VocabEntryDetailsProps = {
  entry: VocabEntry;
  contextText: string;
  addingContext: boolean;
  deletingContextId: string | null;
  onAddContext: () => void;
  onDeleteContext: (contextId: string) => void;
  onNoteChange: (note: string) => void;
  getContextSurfaceState: (contextId: string) => WordSurfaceState;
  onContextWordSelect: (
    contextId: string,
    sentence: string,
    startIndex: number,
    endIndex: number,
  ) => void;
};

export function VocabEntryDetails({
  entry,
  contextText,
  addingContext,
  deletingContextId,
  onAddContext,
  onDeleteContext,
  onNoteChange,
  getContextSurfaceState,
  onContextWordSelect,
}: VocabEntryDetailsProps) {
  const noteId = useId();
  const canAddContext = Boolean(contextText.trim());

  return (
    <div className="vocabEntryDetails">
      <div className="vocabCardSection">
        <div className="vocabCardSectionHeader">
          <p className="vocabCardLabel">
            Contexts{entry.contexts.length ? ` (${entry.contexts.length})` : ""}
          </p>
          <IconButton
            label="Add current context"
            title={
              canAddContext
                ? "Add current context"
                : "No context available on this page"
            }
            hidden={!canAddContext}
            onClick={onAddContext}
          >
            {addingContext ? <span className="inlineSpinner" /> : <PlusIcon />}
          </IconButton>
        </div>
        {entry.contexts.length ? (
          <ul className="vocabContextList">
            {[...entry.contexts].reverse().map((context) => {
              const contextState = getContextSurfaceState(context.id);

              return (
                <li key={context.id} className="vocabContextItem">
                  <InteractiveWordText
                    text={context.sentence}
                    className="wordText vocabContextText"
                    highlight={contextState.highlight}
                    loading={contextState.loading}
                    phraseRange={contextState.phraseRange}
                    savedTermRanges={findContextTermWordRanges(
                      context.sentence,
                      entry.original,
                    )}
                    onWordSelect={(startIndex, endIndex) =>
                      onContextWordSelect(
                        context.id,
                        context.sentence,
                        startIndex,
                        endIndex,
                      )
                    }
                  />
                  <div className="vocabContextFooter">
                    <p className="vocabContextMeta">
                      {formatSavedDate(context.addedAt)}
                      {context.url ? (
                        <>
                          {" · "}
                          <a
                            className="vocabContextLink"
                            href={context.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={context.url}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {formatContextHost(context.url)}
                          </a>
                        </>
                      ) : null}
                    </p>
                    <IconButton
                      label="Delete context"
                      title="Delete context"
                      className="vocabContextDelete"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteContext(context.id);
                      }}
                    >
                      {deletingContextId === context.id ? (
                        <span className="inlineSpinner" aria-hidden="true" />
                      ) : (
                        <TrashIcon />
                      )}
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="vocabCardEmpty">No contexts saved yet.</p>
        )}
      </div>

      <div className="vocabCardSection">
        <div className="vocabCardSectionHeader">
          <label className="vocabCardLabel" htmlFor={noteId}>
            Note
          </label>
        </div>
        <textarea
          id={noteId}
          className="vocabNoteInput"
          rows={3}
          value={entry.note}
          placeholder="Add a note to help you remember this word…"
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </div>

      <div className="vocabCardFooterRow">
        <p className="vocabCardFooter">Saved {formatSavedDate(entry.createdAt)}</p>
        <button
          type="button"
          className="vocabLibraryLink"
          onClick={(event) => {
            event.stopPropagation();
            void openLibraryTab(entry.normalized);
          }}
        >
          Go to Library
        </button>
      </div>
    </div>
  );
}
