import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatKeyboardShortcut,
  keyboardEventToShortcut,
  shortcutsEqual,
  type KeyboardShortcut,
} from "@/utils/keyboard-shortcut";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type KeybindInputProps = {
  id?: string;
  label: string;
  description?: string;
  value: KeyboardShortcut;
  defaultShortcut: KeyboardShortcut;
  onChange: (shortcut: KeyboardShortcut) => void;
  disabled?: boolean;
};

export function KeybindInput({
  id: idProp,
  label,
  description,
  value,
  defaultShortcut,
  onChange,
  disabled = false,
}: KeybindInputProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const stopRecording = useCallback(() => {
    setRecording(false);
  }, []);
  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;

  const startRecording = useCallback(() => {
    if (disabled) {
      return;
    }

    setRecording(true);
    buttonRef.current?.focus();
  }, [disabled]);

  const resetToDefault = useCallback(() => {
    if (disabled || shortcutsEqual(value, defaultShortcut)) {
      return;
    }

    stopRecording();
    onChange(defaultShortcut);
  }, [defaultShortcut, disabled, onChange, stopRecording, value]);

  const isDefault = shortcutsEqual(value, defaultShortcut);

  useEffect(() => {
    if (!recording) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        stopRecordingRef.current();
        return;
      }

      const shortcut = keyboardEventToShortcut(event);
      if (!shortcut) {
        return;
      }

      onChangeRef.current(shortcut);
      stopRecordingRef.current();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [recording]);

  useEffect(() => {
    if (!recording) {
      return;
    }

    const onBlur = () => {
      stopRecordingRef.current();
    };

    const button = buttonRef.current;
    button?.addEventListener("blur", onBlur);
    return () => {
      button?.removeEventListener("blur", onBlur);
    };
  }, [recording]);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={inputId}>{label}</Label>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          disabled={disabled || recording || isDefault}
          aria-label={`Reset ${label} to ${formatKeyboardShortcut(defaultShortcut)}`}
          onClick={resetToDefault}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
        <button
          ref={buttonRef}
          id={inputId}
          type="button"
          disabled={disabled}
          aria-label={
            recording
              ? `Recording shortcut for ${label}. Press keys or Escape to cancel.`
              : `Change shortcut for ${label}. Current shortcut: ${formatKeyboardShortcut(value)}`
          }
          aria-pressed={recording}
          onClick={startRecording}
          className={cn(
            "rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[13px] text-foreground transition-colors",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:pointer-events-none disabled:opacity-50",
            recording &&
              "border-primary bg-[#fdf6e3] text-primary ring-2 ring-primary/20",
          )}
        >
          {recording ? "Press shortcut…" : formatKeyboardShortcut(value)}
        </button>
      </div>
    </div>
  );
}
