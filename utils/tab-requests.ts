type TabRequestState = {
  generation: number;
  abortController: AbortController | null;
};

const tabRequests = new Map<number, TabRequestState>();

export function beginTabRequest(tabId: number): {
  requestId: number;
  signal: AbortSignal;
} {
  const previous = tabRequests.get(tabId);
  previous?.abortController?.abort();

  const requestId = (previous?.generation ?? 0) + 1;
  const abortController = new AbortController();
  tabRequests.set(tabId, { generation: requestId, abortController });

  return { requestId, signal: abortController.signal };
}

export function getTabRequestGeneration(tabId: number): number {
  return tabRequests.get(tabId)?.generation ?? 0;
}

export function isCurrentTabRequest(tabId: number, requestId: number): boolean {
  return getTabRequestGeneration(tabId) === requestId;
}

/** Abort in-flight work and invalidate any pending results for this tab. */
export function invalidateTabRequest(tabId: number): number | null {
  const state = tabRequests.get(tabId);
  const cancelledRequestId = state?.generation ?? null;

  state?.abortController?.abort();

  if (state) {
    tabRequests.set(tabId, {
      generation: state.generation + 1,
      abortController: null,
    });
  }

  return cancelledRequestId;
}

export function clearTabRequest(tabId: number): void {
  const state = tabRequests.get(tabId);
  state?.abortController?.abort();
  tabRequests.delete(tabId);
}
