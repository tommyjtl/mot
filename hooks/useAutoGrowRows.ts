import { useCallback, useEffect, useState, type RefObject } from "react";

export function useAutoGrowRows(
  elementRef: RefObject<HTMLElement | null>,
  contentKey: string,
  maxRows: number,
  disabled = false,
): number {
  const [rows, setRows] = useState(1);

  const measure = useCallback(() => {
    const el = elementRef.current;
    if (!el || disabled) {
      return;
    }

    const overflows = el.scrollHeight > el.clientHeight + 1;

    setRows((current) => {
      if (current < maxRows && overflows) {
        return current + 1;
      }

      return current;
    });

    if (overflows) {
      el.scrollTop = el.scrollHeight;
    }
  }, [disabled, elementRef, maxRows]);

  useEffect(() => {
    if (disabled) {
      return;
    }

    if (!contentKey) {
      setRows(1);
      return;
    }

    requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(measure);
    });
  }, [contentKey, disabled, measure]);

  return rows;
}
