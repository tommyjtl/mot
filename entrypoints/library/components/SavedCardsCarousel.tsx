import { useCallback, useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VocabEntry } from "@/utils/vocab/types";
import { Flashcard } from "./Flashcard";
import { WeekRail } from "./WeekRail";
import { useLibraryWeekNavigation } from "../hooks/useLibraryWeekNavigation";

type SavedCardsCarouselProps = {
  entries: VocabEntry[];
  onOpenDetails: (entry: VocabEntry) => void;
};

export function SavedCardsCarousel({
  entries,
  onOpenDetails,
}: SavedCardsCarouselProps) {
  const {
    activeBucket,
    weekEntries,
    activeEntry,
    cardIndex,
    canGoToOlderWeek,
    canGoToNewerWeek,
    canGoPreviousCard,
    canGoNextCard,
    goToOlderWeek,
    goToNewerWeek,
    goToPreviousCard,
    goToNextCard,
  } = useLibraryWeekNavigation(entries);

  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
  }, [activeEntry?.normalized, activeBucket?.weekStart]);

  const handleFlip = useCallback(() => {
    setIsFlipped((current) => !current);
  }, []);

  const handleOpenDetails = useCallback(() => {
    if (!activeEntry) {
      return;
    }

    onOpenDetails(activeEntry);
  }, [activeEntry, onOpenDetails]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (canGoPreviousCard) {
          goToPreviousCard();
        }
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (canGoNextCard) {
          goToNextCard();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    canGoNextCard,
    canGoPreviousCard,
    goToNextCard,
    goToPreviousCard,
  ]);

  if (entries.length === 0) {
    return null;
  }

  const previousEntry = canGoPreviousCard ? weekEntries[cardIndex - 1] : null;
  const nextEntry = canGoNextCard ? weekEntries[cardIndex + 1] : null;

  return (
    <section aria-label="Saved flashcards">
      <WeekRail
        weekStart={activeBucket?.weekStart ?? null}
        canGoToOlderWeek={canGoToOlderWeek}
        canGoToNewerWeek={canGoToNewerWeek}
        onGoToOlderWeek={goToOlderWeek}
        onGoToNewerWeek={goToNewerWeek}
      />

      <div className="libraryCarousel">
        {previousEntry ? (
          <div className="libraryCarouselGhost libraryCarouselGhost--left">
            <Flashcard
              entry={previousEntry}
              isActive={false}
              isFlipped={false}
              interactive={false}
              onFlip={() => undefined}
              onOpenDetails={() => undefined}
            />
          </div>
        ) : null}

        <div className="libraryCarouselActive">
          {activeEntry ? (
            <Flashcard
              entry={activeEntry}
              isActive
              isFlipped={isFlipped}
              interactive
              onFlip={handleFlip}
              onOpenDetails={handleOpenDetails}
            />
          ) : null}
        </div>

        {nextEntry ? (
          <div className="libraryCarouselGhost libraryCarouselGhost--right">
            <Flashcard
              entry={nextEntry}
              isActive={false}
              isFlipped={false}
              interactive={false}
              onFlip={() => undefined}
              onOpenDetails={() => undefined}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-9"
          aria-label="Previous card"
          disabled={!canGoPreviousCard}
          onClick={goToPreviousCard}
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
        </Button>

        <p className="text-sm text-muted-foreground">
          {weekEntries.length === 0
            ? "0 of 0"
            : `${cardIndex + 1} of ${weekEntries.length}`}
        </p>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-9"
          aria-label="Next card"
          disabled={!canGoNextCard}
          onClick={goToNextCard}
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
