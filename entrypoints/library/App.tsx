import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLibraryEntryParam,
  setLibraryEntryParam,
} from "@/utils/open-library";
import { getVocabEntryByNormalized } from "@/utils/vocab/vocab-store";
import type { VocabEntry } from "@/utils/vocab/types";
import { useLibraryEntries } from "./hooks/useLibraryEntries";
import { useLibraryLayout } from "./hooks/useLibraryLayout";
import { LibraryEmptyState } from "./components/LibraryEmptyState";
import { LibraryLayoutToggle } from "./components/LibraryLayoutToggle";
import { LibrarySortSelect } from "./components/LibrarySortSelect";
import { SavedCardsCarousel } from "./components/SavedCardsCarousel";
import { SavedEntryDialog } from "./components/SavedEntryDialog";
import { SavedMasonryGrid } from "./components/SavedMasonryGrid";
import { useSavedPronunciation } from "./hooks/useSavedPronunciation";

export function App() {
  const {
    entries,
    cardEntries,
    filteredCount,
    totalCount,
    loading,
    query,
    setQuery,
    sort,
    setSort,
    hasMore,
    loadMore,
    removeEntry,
    updateEntry,
  } = useLibraryEntries();
  const { layout, setLayout, ready: layoutReady } = useLibraryLayout();
  const [selectedEntry, setSelectedEntry] = useState<VocabEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const { speak, getHighlight } = useSavedPronunciation();

  const openEntry = useCallback((entry: VocabEntry) => {
    setSelectedEntry(entry);
    setDialogOpen(true);
    setLibraryEntryParam(entry.normalized);
  }, []);

  useEffect(() => {
    if (deepLinkHandled || loading) {
      return;
    }

    const normalized = getLibraryEntryParam();
    if (!normalized) {
      setDeepLinkHandled(true);
      return;
    }

    void getVocabEntryByNormalized(normalized).then((entry) => {
      if (entry) {
        openEntry(entry);
      } else {
        setLibraryEntryParam(null);
      }
      setDeepLinkHandled(true);
    });
  }, [deepLinkHandled, loading, openEntry]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedEntry(null);
      setLibraryEntryParam(null);
    }
  }, []);

  const handleEntryDeleted = useCallback(
    (normalized: string) => {
      removeEntry(normalized);
      setSelectedEntry(null);
    },
    [removeEntry],
  );

  const showCardsLayout = layoutReady && layout === "cards";

  return (
    <main className="mx-auto max-w-[560px] px-5 py-12">
      <header className="mb-7">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          Saved Library
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">
          {loading
            ? "Loading saved items…"
            : totalCount === 0
              ? "Your saved words and phrases appear here."
              : `${totalCount} saved ${totalCount === 1 ? "item" : "items"}.`}
        </p>
      </header>

      <div className="mb-5 flex items-center gap-2">
        <LibraryLayoutToggle
          value={layout}
          disabled={loading || !layoutReady}
          onValueChange={setLayout}
        />
        {!showCardsLayout ? (
          <>
            <Input
              type="search"
              value={query}
              placeholder="Search saved…"
              aria-label="Search saved items"
              className="min-w-0 flex-1"
              disabled={loading}
              onChange={(event) => setQuery(event.target.value)}
            />
            <LibrarySortSelect
              value={sort}
              disabled={loading}
              onValueChange={setSort}
            />
          </>
        ) : null}
      </div>

      {!loading && totalCount === 0 ? (
        <LibraryEmptyState query={query} />
      ) : showCardsLayout && loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading saved items…
        </p>
      ) : showCardsLayout ? (
        <SavedCardsCarousel
          entries={cardEntries}
          detailsDialogOpen={dialogOpen}
          onOpenDetails={openEntry}
        />
      ) : !loading && filteredCount === 0 ? (
        <LibraryEmptyState query={query} />
      ) : (
        <>
          <SavedMasonryGrid
            entries={entries}
            getSpeakHighlight={getHighlight}
            onSelect={openEntry}
            onSpeak={speak}
          />
          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <Button type="button" variant="secondary" onClick={loadMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}

      <SavedEntryDialog
        entry={selectedEntry}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onEntryChange={updateEntry}
        onEntryDeleted={handleEntryDeleted}
      />
    </main>
  );
}
