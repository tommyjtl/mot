export type TabSessionState = "idle" | "busy" | "active";

const tabSessions = new Map<number, TabSessionState>();

export function getTabSession(tabId: number): TabSessionState {
  return tabSessions.get(tabId) ?? "idle";
}

export function setTabSession(tabId: number, state: TabSessionState): void {
  if (state === "idle") {
    tabSessions.delete(tabId);
    return;
  }

  tabSessions.set(tabId, state);
}

export function clearTabSession(tabId: number): void {
  tabSessions.delete(tabId);
}
