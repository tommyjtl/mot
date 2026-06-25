import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";

type TranscriptEditorProps = {
  value: string;
  onChange: (value: string) => void;
  innerRef?: RefObject<HTMLElement | null>;
  dataRows?: string;
  maxRows: number;
  className?: string;
};

export function TranscriptEditor({
  value,
  onChange,
  innerRef,
  dataRows,
  maxRows,
  className = "transcript isEditing",
}: TranscriptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (innerRef) {
        (innerRef as { current: HTMLElement | null }).current = node;
      }
    },
    [innerRef],
  );

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }

    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const isolateKeyEvent = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      return;
    }

    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
  }, []);

  return (
    <textarea
      ref={setRef}
      className={className}
      data-rows={dataRows ?? String(maxRows)}
      value={value}
      rows={maxRows}
      aria-multiline="true"
      aria-label="Live transcript"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={isolateKeyEvent}
      onKeyUp={isolateKeyEvent}
      onPaste={(event) => event.stopPropagation()}
    />
  );
}
