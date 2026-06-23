import { useId, type ReactNode } from "react";
import type { VocabEntry } from "../../utils/vocab/types";
import {
  findContextTermRanges,
  splitTextByRanges,
} from "../../utils/vocab/context-highlight";
import { IconButton, PlusIcon, TrashIcon } from "./IconButton";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function renderContextSentence(sentence: string, original: string): ReactNode {
  const ranges = findContextTermRanges(sentence, original);
  const segments = splitTextByRanges(sentence, ranges);

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
    <>
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
            className="vocabCardAddContext"
            hidden={!canAddContext}
            onClick={onAddContext}
          >
            {addingContext ? <span className="vocabInlineSpinner" /> : <PlusIcon />}
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
                    {formatDate(context.addedAt)}
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
                          {formatHost(context.url)}
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
                      <span className="vocabInlineSpinner" aria-hidden="true" />
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

      <hr className="translationDivider vocabSectionDivider" aria-hidden="true" />
      <div className="vocabCardSection">
        <label className="vocabCardLabel" htmlFor={noteId}>
          Note
        </label>
        <textarea
          id={noteId}
          className="vocabNoteInput"
          rows={3}
          value={entry.note}
          placeholder="Add a note to help you remember this word…"
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </div>

      <p className="vocabCardFooter">Saved {formatDate(entry.createdAt)}</p>
    </>
  );
}
