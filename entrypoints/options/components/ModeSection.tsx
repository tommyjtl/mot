import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useRuntimeMode } from "../hooks/useRuntimeMode";

export function ModeSection() {
  const runtime = useRuntimeMode();
  const isCloud = runtime.mode === "cloud";

  const onToggle = (checked: boolean) => {
    void runtime.setMode(checked ? "cloud" : "private");
  };

  return (
    <section aria-labelledby="mode-heading" className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="mode-heading" className="text-base font-semibold">
            Mode
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use cloud AI models if your device can&apos;t run them locally, or
            prefer a private server you control.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span
            className={cn(
              "text-xs font-medium",
              isCloud ? "text-muted-foreground" : "text-foreground",
            )}
          >
            Private
          </span>
          <Switch
            id="mode-switch"
            checked={isCloud}
            disabled={!runtime.ready}
            aria-label="Toggle between private and cloud mode"
            onCheckedChange={onToggle}
          />
          <span
            className={cn(
              "text-xs font-medium",
              isCloud ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Cloud
          </span>
        </div>
      </div>

      {runtime.mode === null ? (
        <p className="text-sm text-amber-950 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
          Choose Private or Cloud to enable shortcuts.
        </p>
      ) : null}
    </section>
  );
}
