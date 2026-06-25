import type { KeyboardEvent } from "react";
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
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelect(entry);
  };

  return (
    <div className="group/card mb-3 break-inside-avoid">
      <Card
        className="cursor-pointer transition-[box-shadow,border-color] duration-150 shadow-none group-hover/card:border-[#cfcdc4] group-hover/card:shadow-[0_4px_14px_rgba(38,37,30,0.08)] group-active/card:shadow-[0_2px_6px_rgba(38,37,30,0.06)]"
        role="group"
        tabIndex={0}
        aria-label={`Saved word ${entry.original}`}
        onClick={() => onSelect(entry)}
        onKeyDown={handleCardKeyDown}
      >
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground wrap-break-word">
              {entry.original}
            </p>
            <SavedSpeakButton
              text={entry.original}
              highlight={speakHighlight}
              variant="card"
              className="shrink-0"
              onSpeak={() => onSpeak(entry.original, entry.normalized)}
            />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground wrap-break-word">
            {entry.translation}
          </p>
          <p className="text-xs text-muted-foreground">
            Saved {formatSavedDate(entry.createdAt)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
