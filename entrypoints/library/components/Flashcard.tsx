import { useEffect, type MouseEvent, type ReactNode } from "react";
import { ArrowUpRightIcon, BookAIcon } from "lucide-react";
import { SpeakerIcon } from "@/components/overlay/IconButton";
import { InteractiveWordText } from "@/components/overlay/InteractiveWordText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VocabEntry } from "@/utils/vocab/types";
import { useWordSurfacePronunciation } from "@/hooks/useWordSurfacePronunciation";

const ORIGINAL_SURFACE = "original";

type FlashcardProps = {
  entry: VocabEntry;
  isActive: boolean;
  isFlipped: boolean;
  interactive: boolean;
  onFlip: () => void;
  onOpenDetails: () => void;
};

function FlashcardCenter({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="libraryFlashcardCenter">
      <p className="libraryFieldLabel libraryFlashcardLabel">{label}</p>
      <div className="libraryFlashcardText">{children}</div>
    </div>
  );
}

export function Flashcard({
  entry,
  isActive,
  isFlipped,
  interactive,
  onFlip,
  onOpenDetails,
}: FlashcardProps) {
  const pronunciationEnabled = interactive && isActive && !isFlipped;
  const {
    speakWordRange,
    getSurfaceState,
    resetPronunciation,
  } = useWordSurfacePronunciation(pronunciationEnabled);

  useEffect(() => {
    resetPronunciation();
  }, [entry.id, resetPronunciation]);

  const originalState = getSurfaceState(ORIGINAL_SURFACE);
  const isSpeaking =
    originalState.loading !== null || originalState.highlight !== null;

  const handleFlip = () => {
    if (!interactive) {
      return;
    }

    if (isFlipped) {
      resetPronunciation();
    }

    onFlip();
  };

  const handleFlipClick = (event: MouseEvent) => {
    event.stopPropagation();
    handleFlip();
  };

  const handleOpenDetails = (event: MouseEvent) => {
    event.stopPropagation();
    if (!interactive) {
      return;
    }

    onOpenDetails();
  };

  const topRightActions = interactive ? (
    <div className="libraryFlashcardActions">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={isFlipped ? "Show French" : "Show English"}
        onClick={handleFlipClick}
      >
        <BookAIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label="Open saved details"
        onClick={handleOpenDetails}
      >
        <ArrowUpRightIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  ) : null;

  const frontChrome = interactive ? (
    <>
      {isSpeaking ? (
        <div
          className="libraryFlashcardSpeaker isActive"
          aria-hidden="true"
        >
          <SpeakerIcon />
        </div>
      ) : null}
      {topRightActions}
    </>
  ) : null;

  const backChrome = interactive ? topRightActions : null;

  return (
    <div
      className={cn(
        "libraryFlashcardScene",
        interactive && "libraryFlashcardScene--interactive",
      )}
      aria-hidden={!interactive}
    >
      <div
        className={cn(
          "libraryFlashcardInner",
          interactive && isFlipped && "libraryFlashcardInner--flipped",
        )}
      >
        <div className="libraryFlashcardFace libraryFlashcardFace--front">
          {frontChrome}
          <FlashcardCenter label="French">
            {interactive ? (
              <InteractiveWordText
                text={entry.original}
                className="libraryWordText"
                highlight={originalState.highlight}
                loading={originalState.loading}
                phraseRange={originalState.phraseRange}
                onWordSelect={(startIndex, endIndex) =>
                  speakWordRange(
                    ORIGINAL_SURFACE,
                    entry.original,
                    startIndex,
                    endIndex,
                  )
                }
              />
            ) : (
              <p className="libraryWordText">{entry.original}</p>
            )}
          </FlashcardCenter>
        </div>

        <div className="libraryFlashcardFace libraryFlashcardFace--back">
          {backChrome}
          <FlashcardCenter label="English">
            <p className="libraryTranslationText">{entry.translation}</p>
          </FlashcardCenter>
        </div>
      </div>
    </div>
  );
}
