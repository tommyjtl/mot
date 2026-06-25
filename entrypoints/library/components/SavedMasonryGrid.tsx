import type { VocabEntry } from "@/utils/vocab/types";
import type { SavedSpeakHighlight } from "../hooks/useSavedPronunciation";
import { SavedCard } from "./SavedCard";

type SavedMasonryGridProps = {
  entries: VocabEntry[];
  getSpeakHighlight: (key: string) => SavedSpeakHighlight;
  onSelect: (entry: VocabEntry) => void;
  onSpeak: (text: string, key: string) => void;
};

export function SavedMasonryGrid({
  entries,
  getSpeakHighlight,
  onSelect,
  onSpeak,
}: SavedMasonryGridProps) {
  return (
    <div className="columns-2 gap-3 [column-fill:balance]">
      {entries.map((entry) => (
        <SavedCard
          key={entry.normalized}
          entry={entry}
          speakHighlight={getSpeakHighlight(entry.normalized)}
          onSelect={onSelect}
          onSpeak={onSpeak}
        />
      ))}
    </div>
  );
}
