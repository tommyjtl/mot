import { formatSavedDate } from "@/components/vocab/vocab-format";
import { Card, CardContent } from "@/components/ui/card";
import type { VocabEntry } from "@/utils/vocab/types";
import type { SavedSpeakHighlight } from "../hooks/useSavedPronunciation";
import { SavedSpeakButton } from "./SavedSpeakButton";

type SavedCardProps = {
  entry: VocabEntry;
  speakHighlight: SavedSpeakHighlight;
  onSelect: (entry: VocabEntry) => void;
  onSpeak: (text: string, key: string) => void;
};

export function SavedCard({
  entry,
  speakHighlight,
  onSelect,
  onSpeak,
}: SavedCardProps) {
  return (
    <div className="group/card mb-3 break-inside-avoid">
      <Card className="relative transition-[box-shadow,border-color] duration-150 shadow-none group-hover/card:border-[#cfcdc4] group-hover/card:shadow-[0_4px_14px_rgba(38,37,30,0.08)] group-active/card:shadow-[0_2px_6px_rgba(38,37,30,0.06)]">
        <SavedSpeakButton
          text={entry.original}
          highlight={speakHighlight}
          variant="card"
          className="absolute right-2 top-2 z-10"
          onSpeak={() => onSpeak(entry.original, entry.normalized)}
        />
        <button
          type="button"
          className="block w-full cursor-pointer pr-8 text-left"
          onClick={() => onSelect(entry)}
        >
          <CardContent className="space-y-2 p-4">
            <p className="text-base font-semibold leading-snug text-foreground break-words">
              {entry.original}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground break-words">
              {entry.translation}
            </p>
            <p className="text-xs text-muted-foreground">
              Saved {formatSavedDate(entry.createdAt)}
            </p>
          </CardContent>
        </button>
      </Card>
    </div>
  );
}
