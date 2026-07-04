import { cn } from "@/lib/utils";

type SwitchProps = {
  id?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label"?: string;
};

export function Switch({
  id,
  checked,
  disabled,
  onCheckedChange,
  "aria-label": ariaLabel,
}: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors",
        checked ? "bg-foreground" : "bg-muted",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
