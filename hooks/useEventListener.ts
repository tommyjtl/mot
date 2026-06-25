import { useEffect, useRef } from "react";

type EventTargetLike = {
  addEventListener: (
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) => void;
};

export function useEventListener<E extends Event>(
  target: EventTargetLike | null | undefined,
  type: string,
  handler: (event: E) => void,
  options?: boolean | AddEventListenerOptions,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const capture =
    typeof options === "boolean" ? options : (options?.capture ?? false);

  useEffect(() => {
    if (!enabled || !target) {
      return;
    }

    const listener: EventListener = (event) => {
      handlerRef.current(event as E);
    };

    target.addEventListener(type, listener, options);
    return () => target.removeEventListener(type, listener, options);
  }, [target, type, enabled, capture]);
}
