import { createStore, type Store } from "./create-store";

const CHANGE_EVENT = "motif:cross-store-change";

type ChangeDetail = {
  storageKey: string;
};

/**
 * Store synced across content-script isolated worlds on the same tab via
 * sessionStorage + a document event (shared DOM, not shared JS heap).
 */
export function createCrossContextStore<T>(
  storageKey: string,
  initial: () => T,
): Store<T> {
  function readPersisted(): T | null {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  const store = createStore(readPersisted() ?? initial());
  let syncing = false;

  function persist(state: T): void {
    if (syncing) {
      return;
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // sessionStorage may be unavailable in rare contexts.
    }

    document.dispatchEvent(
      new CustomEvent<ChangeDetail>(CHANGE_EVENT, {
        detail: { storageKey },
      }),
    );
  }

  const setState = store.setState.bind(store);
  store.setState = (partial) => {
    setState(partial);
    persist(store.getState());
  };

  document.addEventListener(CHANGE_EVENT, (event) => {
    const detail = (event as CustomEvent<ChangeDetail>).detail;
    if (detail?.storageKey !== storageKey) {
      return;
    }

    const next = readPersisted();
    if (!next) {
      return;
    }

    const current = store.getState();
    if (JSON.stringify(current) === JSON.stringify(next)) {
      return;
    }

    syncing = true;
    setState(next);
    syncing = false;
  });

  return store;
}
