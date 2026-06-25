import { useCallback, useMemo, useState } from "react";
import type { VocabEntry } from "@/utils/vocab/types";
import { bucketEntriesByWeek, type WeekBucket } from "../lib/week-bucket";

export type NavigationAnchor = {
  weekStart: number | null;
  entryId: string | null;
  cardIndex: number;
  fallbackWeekIndex: number;
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

function resolveNavigationPosition(
  buckets: WeekBucket[],
  anchor: NavigationAnchor,
): { weekIndex: number; cardIndex: number } {
  if (buckets.length === 0) {
    return { weekIndex: 0, cardIndex: 0 };
  }

  let weekIndex = 0;
  if (anchor.weekStart !== null) {
    const foundWeek = buckets.findIndex(
      (bucket) => bucket.weekStart === anchor.weekStart,
    );
    weekIndex =
      foundWeek >= 0
        ? foundWeek
        : clampIndex(anchor.fallbackWeekIndex, buckets.length);
  }

  const weekEntries = buckets[weekIndex]?.entries ?? [];
  let cardIndex = 0;

  if (anchor.entryId !== null) {
    const foundCard = weekEntries.findIndex(
      (entry) => entry.id === anchor.entryId,
    );
    cardIndex =
      foundCard >= 0
        ? foundCard
        : clampIndex(anchor.cardIndex, weekEntries.length);
  } else {
    cardIndex = clampIndex(anchor.cardIndex, weekEntries.length);
  }

  return { weekIndex, cardIndex };
}

function anchorFromPosition(
  buckets: WeekBucket[],
  weekIndex: number,
  cardIndex: number,
): NavigationAnchor {
  const weekEntries = buckets[weekIndex]?.entries ?? [];

  return {
    weekStart: buckets[weekIndex]?.weekStart ?? null,
    entryId: weekEntries[cardIndex]?.id ?? null,
    cardIndex,
    fallbackWeekIndex: weekIndex,
  };
}

const DEFAULT_ANCHOR: NavigationAnchor = {
  weekStart: null,
  entryId: null,
  cardIndex: 0,
  fallbackWeekIndex: 0,
};

export function useLibraryWeekNavigation(entries: VocabEntry[]) {
  const buckets = useMemo(() => bucketEntriesByWeek(entries), [entries]);
  const [anchor, setAnchor] = useState<NavigationAnchor>(DEFAULT_ANCHOR);

  const { weekIndex, cardIndex } = useMemo(
    () => resolveNavigationPosition(buckets, anchor),
    [buckets, anchor],
  );

  const activeBucket: WeekBucket | null = buckets[weekIndex] ?? null;
  const weekEntries = activeBucket?.entries ?? [];
  const activeEntry = weekEntries[cardIndex] ?? null;

  /** buckets[0] is newest; older weeks have higher indices. */
  const goToOlderWeek = useCallback(() => {
    setAnchor((current) => {
      const { weekIndex: currentWeekIndex } = resolveNavigationPosition(
        buckets,
        current,
      );
      const nextWeekIndex =
        buckets.length === 0
          ? 0
          : Math.min(currentWeekIndex + 1, buckets.length - 1);

      return anchorFromPosition(buckets, nextWeekIndex, 0);
    });
  }, [buckets]);

  const goToNewerWeek = useCallback(() => {
    setAnchor((current) => {
      const { weekIndex: currentWeekIndex } = resolveNavigationPosition(
        buckets,
        current,
      );
      const nextWeekIndex = Math.max(currentWeekIndex - 1, 0);

      return anchorFromPosition(buckets, nextWeekIndex, 0);
    });
  }, [buckets]);

  const goToPreviousCard = useCallback(() => {
    setAnchor((current) => {
      const { weekIndex: currentWeekIndex, cardIndex: currentCardIndex } =
        resolveNavigationPosition(buckets, current);
      const nextCardIndex = Math.max(currentCardIndex - 1, 0);

      return anchorFromPosition(buckets, currentWeekIndex, nextCardIndex);
    });
  }, [buckets]);

  const goToNextCard = useCallback(() => {
    setAnchor((current) => {
      const { weekIndex: currentWeekIndex, cardIndex: currentCardIndex } =
        resolveNavigationPosition(buckets, current);
      const weekLength = buckets[currentWeekIndex]?.entries.length ?? 0;
      const nextCardIndex =
        weekLength === 0
          ? 0
          : Math.min(currentCardIndex + 1, weekLength - 1);

      return anchorFromPosition(buckets, currentWeekIndex, nextCardIndex);
    });
  }, [buckets]);

  return {
    buckets,
    activeBucket,
    weekEntries,
    activeEntry,
    weekIndex,
    cardIndex,
    canGoToOlderWeek: weekIndex < buckets.length - 1,
    canGoToNewerWeek: weekIndex > 0,
    canGoPreviousCard: cardIndex > 0,
    canGoNextCard: cardIndex < weekEntries.length - 1,
    goToOlderWeek,
    goToNewerWeek,
    goToPreviousCard,
    goToNextCard,
  };
}
