import { useEventListener } from "./useEventListener";

export function useDocumentEvent<K extends keyof DocumentEventMap>(
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
  enabled = true,
): void {
  useEventListener<DocumentEventMap[K]>(
    typeof document === "undefined" ? null : document,
    type,
    handler,
    options,
    enabled,
  );
}
