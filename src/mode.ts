import { createStore } from './store'

// Which home the visitor gets: the first-person game or the plain page. Remembered across visits.
export type Mode = 'game' | 'plain'

const KEY = 'home-mode'
const FADE_MS = 550

function webglAvailable(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}

function stored(): Mode | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'game' || v === 'plain' ? v : null
  } catch {
    return null
  }
}

export const canPlay = webglAvailable()

export const modeStore = createStore({
  mode: (canPlay ? (stored() ?? 'game') : 'plain') as Mode,
  /** True while the screen fades to black between the two homes. */
  fading: false,
})

export function switchMode(next: Mode) {
  if (modeStore.get().fading || modeStore.get().mode === next) return
  if (next === 'game' && !canPlay) return
  modeStore.set({ fading: true })
  window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Private windows may refuse storage; the choice then lasts for this visit only.
    }
    modeStore.set({ mode: next, fading: false })
  }, FADE_MS)
}
