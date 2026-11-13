import { Vector3 } from 'three'
import type { SectionId } from '../content'

// The observation module, in metres: an eight-sided tube lying along Z.
// The big round window is at the -Z end, the hatch at the +Z end, the deck at y = 0.
// The Blender model must match these numbers.

/** The hull's cross-section: a regular octagon, described by the distance from its centre to each flat side. */
export const HULL = { apothem: 2.1, centerY: 1.45, halfLength: 4.5 }

/** The box the visitor and the floating props stay inside. */
export const ROOM = { halfX: 1.5, halfZ: HULL.halfLength, height: 3 }
export const EYE_HEIGHT = 1.6
export const PLAYER_RADIUS = 0.35
export const SPAWN = { x: 0, z: 3.2, yaw: 0, pitch: -0.04 }

/** Things the visitor can open: the three page entrances and the switch to the plain site. */
export type MainId = SectionId | 'switch'

export const WINDOW = { centerY: 1.7, radius: 1.45 }
export const HATCH = { centerY: 1.15, radius: 0.75 }

// --- Telescope (Publications): on a pier in front of the window, pointing up and out.
export const TELESCOPE = {
  pier: new Vector3(0, 0, -3.0),
  eyepiece: new Vector3(0, 1.42, -2.05),
  direction: new Vector3(0, 0.26, -0.966).normalize(),
  length: 1.9,
}

// --- The observer's desk: one console built into the +X wall, holding the monitor and the photo.
export const DESK = { center: new Vector3(1.72, 0.45, -0.9), size: new Vector3(0.65, 0.9, 2.2) }

// --- Terminal (Code): a monitor on the desk, screen facing the room (-X).
export const TERMINAL = {
  screen: {
    center: new Vector3(1.82, DESK.size.y + 0.34, -1.3),
    width: 0.6,
    height: 0.375,
    normal: new Vector3(-1, 0, 0),
  },
}

// --- Photo frame (About): on the same desk, a metre along, photo facing the room (-X).
export const FRAME = {
  photo: { center: new Vector3(1.8, 1.13, -0.35), width: 0.24, height: 0.3 },
}

// --- Main switch (plain site): on the hatch wall, right of the hatch.
export const SWITCH = { center: new Vector3(1.15, 1.35, HULL.halfLength - 0.06) }

// --- Spectrum monitor (decoration): on the -X wall opposite the desk, between two ribs, facing +X.
export const SPECTRUM = { center: new Vector3(-HULL.apothem + 0.05, 1.6, 0.15), width: 1.1, height: 0.63 }

/** Click targets, as spheres. */
export const TARGETS: Record<MainId, { center: Vector3; radius: number }> = {
  publications: {
    center: TELESCOPE.eyepiece.clone().addScaledVector(TELESCOPE.direction, 0.8),
    radius: 0.85,
  },
  code: { center: TERMINAL.screen.center, radius: 0.4 },
  about: { center: FRAME.photo.center, radius: 0.28 },
  switch: { center: SWITCH.center, radius: 0.3 },
}

/** How close the visitor has to be before an object responds. */
export const REACH = 3.4

export interface CameraPose {
  position: Vector3
  target: Vector3
  fov: number
}

export const BASE_FOV = 72

/** Where the camera ends up when an object is opened, just before the page takes over. */
export const POSES: Record<SectionId, CameraPose> = {
  // Eye to the eyepiece, looking along the tube.
  publications: {
    position: TELESCOPE.eyepiece.clone().addScaledVector(TELESCOPE.direction, -0.42),
    target: TELESCOPE.eyepiece.clone().addScaledVector(TELESCOPE.direction, 2),
    fov: 26,
  },
  // Square on to the screen, close enough that it covers the whole view.
  code: {
    position: TERMINAL.screen.center.clone().addScaledVector(TERMINAL.screen.normal, 0.36),
    target: TERMINAL.screen.center,
    fov: 50,
  },
  // The photo fills most of the height, ready to fly out into the page.
  about: {
    position: FRAME.photo.center.clone().add(new Vector3(-0.47, 0, 0)),
    target: FRAME.photo.center,
    fov: 50,
  },
}

/** Deck areas the visitor cannot walk into: [minX, maxX, minZ, maxZ]. */
export const OBSTACLES: [number, number, number, number][] = [
  [1.4, 1.5, -2.0, 0.2], // desk
  [-0.55, 0.55, -4.5, -1.9], // telescope
]
