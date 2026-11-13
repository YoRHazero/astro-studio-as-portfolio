import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Group, Vector3 } from 'three'
import { EARTH_DAY_MS, EARTH_ROTATION_EPOCH_MS, EARTH_SPIN_AXIS, updateEarthRotation } from '../src/game/earth-rotation.ts'

function exportedNorthPole() {
  const file = readFileSync(new URL('../public/models/earth.glb', import.meta.url))
  const jsonLength = file.readUInt32LE(12)
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString())
  const binary = file.subarray(28 + jsonLength)
  const surface = gltf.nodes.find((n: { name: string }) => n.name === 'earth_surface')
  const attrs = gltf.meshes[surface.mesh].primitives[0].attributes
  function attribute(index: number, size: number) {
    const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView]
    assert.equal(a.componentType, 5126)
    const offset = (v.byteOffset ?? 0) + (a.byteOffset ?? 0)
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: size }, (_, j) =>
      binary.readFloatLE(offset + i * (v.byteStride ?? size * 4) + j * 4)))
  }
  const positions = attribute(attrs.POSITION, 3), uv = attribute(attrs.TEXCOORD_0, 2)
  return new Vector3(...positions[uv.findIndex((v) => v[1] === 0)]).normalize()
}

test('the actual mesh pole stays on the tilted spin axis throughout a day', () => {
  const north = exportedNorthPole(), earth = new Group()
  earth.position.set(70, -300, -350)
  earth.scale.setScalar(270)
  for (let hour = 0; hour <= 24; hour++) {
    updateEarthRotation(earth, EARTH_ROTATION_EPOCH_MS + hour * 3_600_000)
    assert.ok(north.clone().applyQuaternion(earth.quaternion).distanceTo(EARTH_SPIN_AXIS) < 1e-6)
  }
  assert.deepEqual(earth.position.toArray(), [70, -300, -350])
  assert.deepEqual(earth.scale.toArray(), [270, 270, 270])
})

test('the original sun gives a plausible latitude after the globe is reoriented', () => {
  const sun = new Vector3(-1.6, 6.2, -12.5).normalize()
  const earth = new Group()
  updateEarthRotation(earth, EARTH_ROTATION_EPOCH_MS)
  const north = exportedNorthPole().applyQuaternion(earth.quaternion)
  const latitude = Math.asin(north.dot(sun)) * 180 / Math.PI
  assert.ok(latitude > 20 && latitude < 23.44, `subsolar latitude ${latitude}`)
})

test('24-hour rotation and refresh continuity survive the presentation correction', () => {
  const earth = new Group(), refreshed = new Group()
  const timestamp = EARTH_ROTATION_EPOCH_MS + 12345678
  updateEarthRotation(earth, timestamp)
  const initial = earth.quaternion.clone()
  updateEarthRotation(earth, timestamp + EARTH_DAY_MS / 24)
  assert.ok(Math.abs(initial.angleTo(earth.quaternion) - Math.PI / 12) < 1e-7)
  updateEarthRotation(earth, timestamp + EARTH_DAY_MS)
  assert.ok(initial.angleTo(earth.quaternion) < 1e-7)
  updateEarthRotation(refreshed, timestamp + EARTH_DAY_MS)
  assert.ok(earth.quaternion.angleTo(refreshed.quaternion) < 1e-7)
})
