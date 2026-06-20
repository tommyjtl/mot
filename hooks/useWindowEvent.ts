import { useEventListener } from "./useEventListener";

export function useWindowEvent<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
  enabled = true,
): void {
  useEventListener<WindowEventMap[K]>(
    typeof window === "undefined" ? null : window,
    type,
    handler,
    options,
    enabled,
  );
}
