import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWeekLabel } from "../lib/week-bucket";

const weekNavClassName =
  "h-auto min-h-0 justify-self-start p-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground hover:underline focus-visible:ring-0 focus-visible:ring-offset-0";

type WeekRailProps = {
  weekStart: number | null;
  canGoToOlderWeek: boolean;
  canGoToNewerWeek: boolean;
  onGoToOlderWeek: () => void;
  onGoToNewerWeek: () => void;
};

export function WeekRail({
  weekStart,
  canGoToOlderWeek,
  canGoToNewerWeek,
  onGoToOlderWeek,
  onGoToNewerWeek,
}: WeekRailProps) {
  const label =
    weekStart === null ? "No weeks" : formatWeekLabel(weekStart);

  return (
    <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <Button
        type="button"
        variant="link"
        className={weekNavClassName}
        disabled={!canGoToOlderWeek}
        onClick={onGoToOlderWeek}
      >
        Previous week
      </Button>

      <p
        className="text-center text-sm font-bold text-foreground"
        aria-live="polite"
      >
        {label}
      </p>

      <Button
        type="button"
        variant="link"
        className={cn(weekNavClassName, "justify-self-end")}
        disabled={!canGoToNewerWeek}
        onClick={onGoToNewerWeek}
      >
        Next week
      </Button>
    </div>
  );
}
