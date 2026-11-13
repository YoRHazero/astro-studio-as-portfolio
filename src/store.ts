import { useSyncExternalStore } from 'react'

/** A minimal external store: plain object state, readable from React and from the render loop. */
export function createStore<T extends object>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }
  return {
    get: () => state,
    set(patch: Partial<T>) {
      state = { ...state, ...patch }
      listeners.forEach((l) => l())
    },
    /** Select a primitive (or otherwise stable) value. */
    use<S>(select: (s: T) => S): S {
      return useSyncExternalStore(subscribe, () => select(state))
    },
  }
}
