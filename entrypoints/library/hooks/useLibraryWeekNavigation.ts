import { useCallback, useEffect, useMemo, useState } from "react";
import type { VocabEntry } from "@/utils/vocab/types";
import { bucketEntriesByWeek, type WeekBucket } from "../lib/week-bucket";

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

export function useLibraryWeekNavigation(entries: VocabEntry[]) {
  const buckets = useMemo(() => bucketEntriesByWeek(entries), [entries]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);

  const entriesKey = useMemo(
    () => entries.map((entry) => entry.id).join("\0"),
    [entries],
  );

  useEffect(() => {
    setWeekIndex(0);
    setCardIndex(0);
  }, [entriesKey]);

  const safeWeekIndex = clampIndex(weekIndex, buckets.length);
  const activeBucket: WeekBucket | null = buckets[safeWeekIndex] ?? null;
  const weekEntries = activeBucket?.entries ?? [];
  const safeCardIndex = clampIndex(cardIndex, weekEntries.length);
  const activeEntry = weekEntries[safeCardIndex] ?? null;

  useEffect(() => {
    if (weekIndex !== safeWeekIndex) {
      setWeekIndex(safeWeekIndex);
    }
  }, [safeWeekIndex, weekIndex]);

  useEffect(() => {
    if (cardIndex !== safeCardIndex) {
      setCardIndex(safeCardIndex);
    }
  }, [safeCardIndex, cardIndex]);

  /** buckets[0] is newest; older weeks have higher indices. */
  const goToOlderWeek = useCallback(() => {
    setWeekIndex((current) =>
      buckets.length === 0 ? 0 : Math.min(current + 1, buckets.length - 1),
    );
    setCardIndex(0);
  }, [buckets.length]);

  const goToNewerWeek = useCallback(() => {
    setWeekIndex((current) => Math.max(current - 1, 0));
    setCardIndex(0);
  }, []);

  const goToPreviousCard = useCallback(() => {
    setCardIndex((current) => Math.max(current - 1, 0));
  }, []);

  const goToNextCard = useCallback(() => {
    setCardIndex((current) =>
      weekEntries.length === 0
        ? 0
        : Math.min(current + 1, weekEntries.length - 1),
    );
  }, [weekEntries.length]);

  return {
    buckets,
    activeBucket,
    weekEntries,
    activeEntry,
    weekIndex: safeWeekIndex,
    cardIndex: safeCardIndex,
    canGoToOlderWeek: safeWeekIndex < buckets.length - 1,
    canGoToNewerWeek: safeWeekIndex > 0,
    canGoPreviousCard: safeCardIndex > 0,
    canGoNextCard: safeCardIndex < weekEntries.length - 1,
    goToOlderWeek,
    goToNewerWeek,
    goToPreviousCard,
    goToNextCard,
  };
}
