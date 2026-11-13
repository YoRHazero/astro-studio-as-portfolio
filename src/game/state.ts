import { Vector3 } from 'three'
import { createStore } from '../store'
import { EYE_HEIGHT, SPAWN, type MainId } from './layout'

/**
 * explore  — the visitor walks around freely
 * entering — the camera is moving into an object; input is ignored
 * page     — a page covers the screen; the camera waits at the object
 * leaving  — the camera is backing out to where the visitor stood
 */
export type Phase = 'explore' | 'entering' | 'page' | 'leaving'

const initial = {
  phase: 'explore' as Phase,
  /** The object being entered or left. */
  focus: null as MainId | null,
  /** What the visitor is pointing at right now. */
  aimed: null as MainId | 'prop' | null,
  /** True while the mouse is captured for looking around. */
  locked: false,
  /** True once the visitor has moved or looked, to retire the first hint. */
  touched: false,
}

export const game = createStore(initial)

/** The visitor's body. Mutated every frame, so it lives outside React. */
export const player = {
  position: new Vector3(SPAWN.x, EYE_HEIGHT, SPAWN.z),
  velocity: new Vector3(),
  yaw: SPAWN.yaw,
  pitch: SPAWN.pitch,
}

export function resetGame() {
  game.set(initial)
  player.position.set(SPAWN.x, EYE_HEIGHT, SPAWN.z)
  player.velocity.set(0, 0, 0)
  player.yaw = SPAWN.yaw
  player.pitch = SPAWN.pitch
}

// Handy in the browser console while developing: __game.player.position.set(…)
if (import.meta.env.DEV) Object.assign(window, { __game: { game, player } })
