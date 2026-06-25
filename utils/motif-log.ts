/** Structured console logging for Motif extension debugging. */
export function motifLog(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (data !== undefined) {
    console.info(`[motif:${scope}] ${message}`, data);
    return;
  }

  console.info(`[motif:${scope}] ${message}`);
}

export function motifWarn(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (data !== undefined) {
    console.warn(`[motif:${scope}] ${message}`, data);
    return;
  }

  console.warn(`[motif:${scope}] ${message}`);
}
