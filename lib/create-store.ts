import { useCallback, useRef, useSyncExternalStore } from "react";

type Listener = () => void;

export type Store<T> = {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  subscribe: (listener: Listener) => () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (partial) => {
      const patch =
        typeof partial === "function" ? partial(state) : partial;
      state = { ...state, ...patch };
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (!Object.is(aRecord[key], bRecord[key])) {
      return false;
    }
  }

  return true;
}

export function createStoreHook<T>(store: Store<T>) {
  function useStore(): T {
    return useSyncExternalStore(
      store.subscribe,
      store.getState,
      store.getState,
    );
  }

  function useStoreSelector<U>(selector: (state: T) => U): U {
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const sliceRef = useRef<U | undefined>(undefined);

    const getSnapshot = useCallback(() => {
      const next = selectorRef.current(store.getState());
      const prev = sliceRef.current;

      if (prev !== undefined && shallowEqual(prev, next)) {
        return prev;
      }

      sliceRef.current = next;
      return next;
    }, []);

    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
  }

  return { useStore, useStoreSelector };
}
