import { SpeakerIcon } from "@/components/overlay/IconButton";
import { cn } from "@/lib/utils";
import type { SavedSpeakHighlight } from "../hooks/useSavedPronunciation";

type SavedSpeakButtonProps = {
  text: string;
  label?: string;
  highlight: SavedSpeakHighlight;
  variant?: "card" | "inline";
  className?: string;
  onSpeak: (text: string) => void;
};

export function SavedSpeakButton({
  text,
  label,
  highlight,
  variant = "card",
  className,
  onSpeak,
}: SavedSpeakButtonProps) {
  const speakLabel =
    label ?? `Hear pronunciation of ${text.trim() || "saved text"}`;

  return (
    <button
      type="button"
      className={cn(
        "savedSpeakButton inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[opacity,background-color,color] duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait",
        variant === "card" && "size-7",
        variant === "inline" && "savedSpeakButton--inline size-8",
        highlight === "loading" && "opacity-65",
        highlight === "active" && "isActive bg-accent text-foreground",
        className,
      )}
      aria-label={speakLabel}
      title={speakLabel}
      disabled={highlight === "loading"}
      onClick={(event) => {
        event.stopPropagation();
        onSpeak(text);
      }}
    >
      {highlight === "loading" ? (
        <span
          className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      ) : (
        <SpeakerIcon />
      )}
    </button>
  );
}
