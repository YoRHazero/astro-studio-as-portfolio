import { createStore } from './store'

// How far the game is from being playable. Fed by the game (which is downloaded separately,
// together with three.js) and read by the loading screen, which is in the main bundle.

export const loading = createStore({
  /** The game's code has arrived and the model downloads have begun. */
  started: false,
  /** Every model is in and the scene has been compiled and drawn once. */
  ready: false,
  /** The loading screen has opened onto the cabin. It does not come back for this visit. */
  revealed: false,
})

interface Download {
  loaded: number
  /** 0 when the server did not say how big the file is. */
  total: number
  done: boolean
}

// Updated many times a second, so it lives outside the store: nothing re-renders on progress.
const downloads = new Map<string, Download>()

export function reportDownload(url: string, loaded: number, total: number, done = false) {
  const previous = downloads.get(url)
  downloads.set(url, {
    loaded: done ? Math.max(loaded, total, previous?.loaded ?? 0) : loaded,
    total: total || previous?.total || 0,
    done,
  })
}

/** Bytes so far across every download, and how far along they are as a whole (0–1). */
export function downloadProgress() {
  let loaded = 0
  let total = 0
  let known = true
  let weighted = 0
  for (const d of downloads.values()) {
    loaded += d.loaded
    total += d.total
    if (!d.total && !d.done) known = false
    // A file of unknown size creeps toward done instead of jumping there.
    const fraction = d.done ? 1 : d.total ? d.loaded / d.total : 1 - Math.exp(-d.loaded / 2e6)
    weighted += fraction * (d.total || 1e6)
  }
  const weight = [...downloads.values()].reduce((sum, d) => sum + (d.total || 1e6), 0)
  return {
    loaded,
    /** null until every file's size is known */
    total: known && downloads.size > 0 ? total : null,
    fraction: weight ? weighted / weight : 0,
  }
}
