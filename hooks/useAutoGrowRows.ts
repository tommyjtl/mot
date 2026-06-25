import { useCallback, useEffect, useState, type RefObject } from "react";

export function useAutoGrowRows(
  elementRef: RefObject<HTMLElement | null>,
  contentKey: string,
  maxRows: number,
  disabled = false,
): number {
  const [rowsState, setRowsState] = useState({ contentKey: "", rows: 1 });
  const rows =
    rowsState.contentKey === contentKey && contentKey ? rowsState.rows : 1;

  const measure = useCallback(() => {
    const el = elementRef.current;
    if (!el || disabled) {
      return;
    }

    const overflows = el.scrollHeight > el.clientHeight + 1;

    setRowsState((current) => {
      const currentRows =
        current.contentKey === contentKey ? current.rows : 1;

      if (currentRows < maxRows && overflows) {
        return { contentKey, rows: currentRows + 1 };
      }

      return { contentKey, rows: currentRows };
    });

    if (overflows) {
      el.scrollTop = el.scrollHeight;
    }
  }, [contentKey, disabled, elementRef, maxRows]);

  useEffect(() => {
    if (disabled || !contentKey) {
      return;
    }

    requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(measure);
    });
  }, [contentKey, disabled, measure]);

  return rows;
}
