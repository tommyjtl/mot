import { useId, type ReactNode } from "react";
import type { VocabEntry } from "../../utils/vocab/types";
import {
  formatContextHost,
  formatSavedDate,
} from "../vocab/vocab-format";
import {
  getContextHighlightSegments,
} from "../../utils/vocab/context-highlight";
import { openLibraryTab } from "../../utils/open-library";
import { IconButton, PlusIcon, TrashIcon } from "./IconButton";

function renderContextSentence(sentence: string, original: string): ReactNode {
  const segments = getContextHighlightSegments(sentence, original);

  return segments.map((segment, index) =>
    segment.kind === "term" ? (
      <strong key={index} className="vocabContextTerm">
        {segment.value}
      </strong>
    ) : (
      segment.value
    ),
  );
}

type VocabEntryDetailsProps = {
  entry: VocabEntry;
  contextText: string;
  addingContext: boolean;
  deletingContextId: string | null;
  onAddContext: () => void;
  onDeleteContext: (contextId: string) => void;
  onNoteChange: (note: string) => void;
};

export function VocabEntryDetails({
  entry,
  contextText,
  addingContext,
  deletingContextId,
  onAddContext,
  onDeleteContext,
  onNoteChange,
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
            {[...entry.contexts].reverse().map((context) => (
              <li key={context.id} className="vocabContextItem">
                <p className="vocabContextSentence">
                  {renderContextSentence(context.sentence, entry.original)}
                </p>
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
            ))}
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
          Go to Library →
        </button>
      </div>
    </div>
  );
}
