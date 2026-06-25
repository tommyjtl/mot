import { GalleryHorizontalEndIcon, LayoutDashboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LibraryLayout } from "../lib/library-layout-preference";

type LibraryLayoutToggleProps = {
  value: LibraryLayout;
  disabled?: boolean;
  onValueChange: (value: LibraryLayout) => void;
};

export function LibraryLayoutToggle({
  value,
  disabled = false,
  onValueChange,
}: LibraryLayoutToggleProps) {
  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-[#cfcdc4] p-0.5"
      role="group"
      aria-label="Library layout"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label="List layout"
        aria-pressed={value === "list"}
        className={cn(
          "size-8 rounded-sm",
          value === "list" && "bg-muted text-foreground",
        )}
        onClick={() => onValueChange("list")}
      >
        <LayoutDashboardIcon className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label="Cards layout"
        aria-pressed={value === "cards"}
        className={cn(
          "size-8 rounded-sm",
          value === "cards" && "bg-muted text-foreground",
        )}
        onClick={() => onValueChange("cards")}
      >
        <GalleryHorizontalEndIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
