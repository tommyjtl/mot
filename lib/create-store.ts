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
