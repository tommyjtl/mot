import type { VocabEntry } from "@/utils/vocab/types";

export type LibrarySortOption =
  | "date-desc"
  | "date-asc"
  | "contexts-desc"
  | "contexts-asc";

export const DEFAULT_LIBRARY_SORT: LibrarySortOption = "date-desc";

export const LIBRARY_SORT_LABELS: Record<LibrarySortOption, string> = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "contexts-desc": "Most contexts",
  "contexts-asc": "Fewest contexts",
};

export function sortLibraryEntries(
  entries: VocabEntry[],
  sort: LibrarySortOption,
): VocabEntry[] {
  const copy = [...entries];

  switch (sort) {
    case "date-desc":
      return copy.sort((a, b) => b.updatedAt - a.updatedAt);
    case "date-asc":
      return copy.sort((a, b) => a.updatedAt - b.updatedAt);
    case "contexts-desc":
      return copy.sort((a, b) => {
        const byContexts = b.contexts.length - a.contexts.length;
        return byContexts !== 0 ? byContexts : b.updatedAt - a.updatedAt;
      });
    case "contexts-asc":
      return copy.sort((a, b) => {
        const byContexts = a.contexts.length - b.contexts.length;
        return byContexts !== 0 ? byContexts : b.updatedAt - a.updatedAt;
      });
  }
}
