import { Quaternion, Vector3, type Object3D } from 'three'

export const EARTH_DAY_MS = 24 * 60 * 60 * 1000
// A fixed reference keeps the same phase across refreshes and both viewers.
// This is the model's presentation pose, not an astronomical ephemeris.
export const EARTH_ROTATION_EPOCH_MS = Date.UTC(2026, 10, 13)

// Reorient the whole globe, including its baked -50° X tilt. The presentation
// north pole leans 23.44° toward +X; with the original cabin sun this gives a
// plausible subsolar latitude (~21°), while keeping the old terminator in place.
// This is a fixed display pose, not a date-dependent orbital simulation.
const bakedTilt = (50 * Math.PI) / 180
const modelNorth = new Vector3(0, Math.cos(bakedTilt), -Math.sin(bakedTilt))
const displayTilt = (23.44 * Math.PI) / 180
export const EARTH_SPIN_AXIS = new Vector3(Math.sin(displayTilt), Math.cos(displayTilt), 0)
const presentationPose = new Quaternion().setFromUnitVectors(modelNorth, EARTH_SPIN_AXIS)

export function updateEarthRotation(earth: Object3D, timestampMs = Date.now()) {
  const elapsed = timestampMs - EARTH_ROTATION_EPOCH_MS
  const phase = ((elapsed % EARTH_DAY_MS) + EARTH_DAY_MS) % EARTH_DAY_MS
  earth.quaternion.setFromAxisAngle(EARTH_SPIN_AXIS, (phase / EARTH_DAY_MS) * Math.PI * 2)
    .multiply(presentationPose)
}
