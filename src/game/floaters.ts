import { Quaternion, Vector3 } from 'three'
import { PLAYER_RADIUS, ROOM, TARGETS } from './layout'
import { player } from './state'

// Loose objects drifting in zero-g. Only the room is weightless: these float, the visitor does not.

export type FloaterKind = 'pen' | 'notebook' | 'blob'

export interface Floater {
  kind: FloaterKind
  radius: number
  position: Vector3
  velocity: Vector3
  rotation: Quaternion
  spinAxis: Vector3
  spinSpeed: number
  /** Blob only: how hard it is currently wobbling, 0–1. */
  wobble: number
}

const START: [FloaterKind, number, [number, number, number]][] = [
  ['pen', 0.1, [-0.7, 1.45, 1.4]],
  ['notebook', 0.16, [0.75, 1.95, -0.4]],
  ['blob', 0.1, [0.6, 1.6, 2.2]],
]

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296 - 0.5
  }
}

export function createFloaters(): Floater[] {
  const random = seeded(7)
  return START.map(([kind, radius, [x, y, z]]) => ({
    kind,
    radius,
    position: new Vector3(x, y, z),
    velocity: new Vector3(random(), random(), random()).multiplyScalar(0.08),
    rotation: new Quaternion(),
    spinAxis: new Vector3(random(), random(), random()).normalize(),
    spinSpeed: 0.2 + Math.abs(random()),
    wobble: 0,
  }))
}

export const floaters = createFloaters()

const push = new Vector3()
const spin = new Quaternion()
const RESTITUTION = 0.6
const MIN_Y = 0.25

export function stepFloaters(dt: number) {
  for (const f of floaters) {
    // Almost no drag: things keep drifting for a long time.
    f.velocity.multiplyScalar(Math.exp(-dt * 0.12))
    f.position.addScaledVector(f.velocity, dt)
    f.rotation.premultiply(spin.setFromAxisAngle(f.spinAxis, f.spinSpeed * dt))
    f.wobble *= Math.exp(-dt * 1.6)

    // Soft bounce off the walls, floor and ceiling.
    const limitX = ROOM.halfX - f.radius
    const limitZ = ROOM.halfZ - f.radius
    if (Math.abs(f.position.x) > limitX) {
      f.position.x = Math.sign(f.position.x) * limitX
      f.velocity.x *= -RESTITUTION
    }
    if (Math.abs(f.position.z) > limitZ) {
      f.position.z = Math.sign(f.position.z) * limitZ
      f.velocity.z *= -RESTITUTION
    }
    if (f.position.y < MIN_Y + f.radius || f.position.y > ROOM.height - f.radius) {
      f.position.y = Math.min(Math.max(f.position.y, MIN_Y + f.radius), ROOM.height - f.radius)
      f.velocity.y *= -RESTITUTION
    }

    // Keep clear of the objects that must stay clickable.
    for (const target of Object.values(TARGETS)) {
      push.subVectors(f.position, target.center)
      const gap = push.length() - (target.radius + f.radius)
      if (gap < 0) f.velocity.addScaledVector(push.normalize(), -gap * 4 * dt + 0.002)
    }

    // The visitor shoulders things aside; nothing ever blocks the way.
    push.set(f.position.x - player.position.x, 0, f.position.z - player.position.z)
    const distance = push.length()
    const reach = PLAYER_RADIUS + f.radius
    if (distance < reach && f.position.y < player.position.y + 0.3) {
      push.normalize()
      f.position.addScaledVector(push, reach - distance)
      f.velocity.addScaledVector(push, 0.25).addScaledVector(player.velocity, 0.6)
      f.spinSpeed = Math.min(3, f.spinSpeed + 0.4)
    }
  }
}

/** A poke from the visitor, along the direction they are looking. */
export function pokeFloater(index: number, direction: Vector3) {
  const f = floaters[index]
  f.velocity.addScaledVector(direction, 0.9)
  f.spinAxis.set(direction.z, 0.4, -direction.x).normalize()
  f.spinSpeed = 2.5
  f.wobble = 1
}
