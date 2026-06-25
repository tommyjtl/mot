export type ModelCardState = "checking" | "loading" | "ready" | "error";

export type ModelCardView = {
  state: ModelCardState;
  detail: string;
  percent?: number;
};

export type TranscriptionStateResponse = {
  active: boolean;
  tabId: number | null;
  tabTitle?: string;
  tabUrl?: string;
  offscreenDocument: boolean;
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function queryWithRetry<T>(
  query: () => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await query();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await delay(120 * (attempt + 1));
      }
    }
  }

  throw lastError;
}

export function formatTargetTab(state: TranscriptionStateResponse): string {
  if (state.active && state.tabTitle) {
    return state.tabTitle;
  }

  if (state.tabUrl) {
    try {
      return new URL(state.tabUrl).hostname;
    } catch {
      return state.tabUrl;
    }
  }

  if (state.active) {
    return `Tab ${state.tabId ?? "?"}`;
  }

  return "None";
}
