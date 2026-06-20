import type { ViewportCaptureSelection } from "./capture-region";

const pendingCaptures = new Map<
  number,
  (value: ViewportCaptureSelection | null) => void
>();

export function beginCaptureWait(requestId: number): Promise<ViewportCaptureSelection | null> {
  cancelCaptureWait(requestId);

  return new Promise((resolve) => {
    pendingCaptures.set(requestId, resolve);
  });
}

export function resolveCaptureWait(
  requestId: number,
  value: ViewportCaptureSelection | null,
): boolean {
  const resolve = pendingCaptures.get(requestId);
  if (!resolve) {
    return false;
  }

  pendingCaptures.delete(requestId);
  resolve(value);
  return true;
}

export function cancelCaptureWait(requestId: number): void {
  resolveCaptureWait(requestId, null);
}

export function cancelAllCaptureWaits(): void {
  for (const requestId of [...pendingCaptures.keys()]) {
    cancelCaptureWait(requestId);
  }
}
