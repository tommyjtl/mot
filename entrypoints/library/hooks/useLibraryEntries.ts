import { useCallback, useEffect, useMemo, useState } from "react";
import { listVocabEntries } from "@/utils/vocab/vocab-store";
import type { VocabEntry } from "@/utils/vocab/types";
import {
  DEFAULT_LIBRARY_SORT,
  sortLibraryEntries,
  type LibrarySortOption,
} from "../lib/sort-entries";

const VOCAB_STORAGE_KEY = "motVocab";
export const LIBRARY_PAGE_SIZE = 30;

function matchesQuery(entry: VocabEntry, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    entry.original.toLowerCase().includes(normalized) ||
    entry.translation.toLowerCase().includes(normalized) ||
    entry.note.toLowerCase().includes(normalized)
  );
}

export function useLibraryEntries() {
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySortOption>(DEFAULT_LIBRARY_SORT);
  const [visibleCount, setVisibleCount] = useState(LIBRARY_PAGE_SIZE);

  const refresh = useCallback(async () => {
    const next = await listVocabEntries();
    setEntries(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const listener = (
      changes: Record<string, browser.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !changes[VOCAB_STORAGE_KEY]) {
        return;
      }

      void refresh();
    };

    browser.storage.onChanged.addListener(listener);
    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }, [refresh]);

  const filteredEntries = useMemo(() => {
    const filtered = entries.filter((entry) => matchesQuery(entry, query));
    return sortLibraryEntries(filtered, sort);
  }, [entries, query, sort]);

  useEffect(() => {
    setVisibleCount(LIBRARY_PAGE_SIZE);
  }, [query, sort]);

  const cardEntries = useMemo(
    () => sortLibraryEntries(entries, "date-desc"),
    [entries],
  );

  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, visibleCount),
    [filteredEntries, visibleCount],
  );

  const hasMore = visibleCount < filteredEntries.length;

  const loadMore = useCallback(() => {
    setVisibleCount((current) => current + LIBRARY_PAGE_SIZE);
  }, []);

  const removeEntry = useCallback((normalized: string) => {
    setEntries((current) =>
      current.filter((entry) => entry.normalized !== normalized),
    );
  }, []);

  const updateEntry = useCallback((next: VocabEntry) => {
    setEntries((current) => {
      const index = current.findIndex(
        (entry) => entry.normalized === next.normalized,
      );
      if (index === -1) {
        return current;
      }

      const copy = [...current];
      copy[index] = next;
      return copy;
    });
  }, []);

  return {
    entries: visibleEntries,
    filteredEntries,
    cardEntries,
    filteredCount: filteredEntries.length,
    totalCount: entries.length,
    loading,
    query,
    setQuery,
    sort,
    setSort,
    hasMore,
    loadMore,
    refresh,
    removeEntry,
    updateEntry,
  };
}
