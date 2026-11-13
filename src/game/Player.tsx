import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Matrix4, Quaternion, Raycaster, Vector2, Vector3, type PerspectiveCamera } from 'three'
import { SECTIONS } from '../content'
import { handoff, type ScreenRect } from '../handoff'
import { switchMode } from '../mode'
import { navigate, useRoute } from '../router'
import { floaters, pokeFloater } from './floaters'
import {
  BASE_FOV,
  EYE_HEIGHT,
  FRAME,
  OBSTACLES,
  PLAYER_RADIUS,
  POSES,
  REACH,
  ROOM,
  SPAWN,
  TARGETS,
  type MainId,
} from './layout'
import { game, player } from './state'

const WALK_SPEED = 2.4
const GLIDE = 3.2 // how quickly velocity follows the keys; low = more glide
const LOOK_SPEED = 0.0024
const MAX_PITCH = 1.25
const ENTER_SECONDS = 1.15
const LEAVE_SECONDS = 1.0

type Aim = { kind: 'main'; id: MainId } | { kind: 'prop'; index: number } | null

interface Flight {
  fromPosition: Vector3
  fromRotation: Quaternion
  fromFov: number
  toPosition: Vector3
  toRotation: Quaternion
  toFov: number
  seconds: number
  elapsed: number
  onArrive: () => void
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const UP = new Vector3(0, 1, 0)
const SCREEN_CENTER = new Vector2(0, 0)
const scratch = { euler: new Euler(0, 0, 0, 'YXZ'), matrix: new Matrix4(), a: new Vector3(), b: new Vector3() }

function lookRotation(yaw: number, pitch: number) {
  return new Quaternion().setFromEuler(scratch.euler.set(pitch, yaw, 0))
}

function poseRotation(position: Vector3, target: Vector3) {
  return new Quaternion().setFromRotationMatrix(scratch.matrix.lookAt(position, target, UP))
}

/** Distance along the ray to a sphere, or null if the ray misses it. */
function raySphere(origin: Vector3, direction: Vector3, center: Vector3, radius: number): number | null {
  const toCenter = scratch.a.subVectors(center, origin)
  const along = toCenter.dot(direction)
  if (along < 0) return null
  const missSq = toCenter.lengthSq() - along * along
  return missSq > radius * radius ? null : along - Math.sqrt(radius * radius - missSq)
}

/** What a ray from the given screen point hits first: an object that opens, or a drifting prop. */
function findAim(raycaster: Raycaster, screenPoint: Vector2, camera: PerspectiveCamera): Aim {
  raycaster.setFromCamera(screenPoint, camera)
  const { origin, direction } = raycaster.ray
  let aim: Aim = null
  let nearest = Infinity
  for (const id of [...SECTIONS, 'switch'] as MainId[]) {
    const target = TARGETS[id]
    if (target.center.distanceTo(player.position) > REACH) continue
    const hit = raySphere(origin, direction, target.center, target.radius)
    if (hit !== null && hit < nearest) {
      nearest = hit
      aim = { kind: 'main', id }
    }
  }
  floaters.forEach((f, index) => {
    const hit = raySphere(origin, direction, f.position, f.radius + 0.05)
    if (hit !== null && hit < nearest && hit < REACH) {
      nearest = hit
      aim = { kind: 'prop', index }
    }
  })
  return aim
}

/** Where the framed photo sits on screen for the given camera, in CSS pixels. */
function photoScreenRect(camera: PerspectiveCamera, width: number, height: number): ScreenRect {
  const { center, width: w, height: h } = FRAME.photo
  const corners = [
    [w / 2, h / 2],
    [-w / 2, -h / 2],
  ].map(([dz, dy]) => {
    const p = new Vector3(center.x, center.y + dy, center.z + dz).project(camera)
    return [(p.x * 0.5 + 0.5) * width, (-p.y * 0.5 + 0.5) * height]
  })
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top }
}

/**
 * The visitor: first-person look and glide, pointing at things, and the camera moves
 * into and out of the objects that lead to pages.
 */
export function Player() {
  const route = useRoute()
  const gl = useThree((s) => s.gl)
  const getState = useThree((s) => s.get)
  const rig = useRef({
    keys: new Set<string>(),
    cursor: new Vector2(),
    aim: null as Aim,
    flight: null as Flight | null,
    /** Where the visitor stood before entering an object. */
    saved: null as { position: Vector3; yaw: number; pitch: number } | null,
    raycaster: new Raycaster(),
    lookDirection: new Vector3(),
  })

  // --- Entering and leaving objects ---------------------------------------------------------

  useEffect(() => {
    const r = rig.current
    if (route !== 'home') {
      // A page is showing (entered through an object, or via browser history).
      r.flight = null
      game.set({ phase: 'page', focus: route, aimed: null })
      return
    }
    const { phase, focus } = game.get()
    if (phase !== 'page' || !focus || focus === 'switch') return
    const pose = POSES[focus]
    const back = r.saved ?? {
      position: new Vector3(SPAWN.x, EYE_HEIGHT, SPAWN.z),
      yaw: SPAWN.yaw,
      pitch: SPAWN.pitch,
    }
    game.set({ phase: 'leaving' })
    r.flight = {
      fromPosition: pose.position.clone(),
      fromRotation: poseRotation(pose.position, pose.target),
      fromFov: pose.fov,
      toPosition: back.position.clone(),
      toRotation: lookRotation(back.yaw, back.pitch),
      toFov: BASE_FOV,
      seconds: LEAVE_SECONDS,
      elapsed: -0.2, // let the page start fading first
      onArrive: () => {
        player.position.copy(back.position)
        player.velocity.set(0, 0, 0)
        player.yaw = back.yaw
        player.pitch = back.pitch
        r.saved = null
        game.set({ phase: 'explore', focus: null })
      },
    }
  }, [route])

  // --- Input --------------------------------------------------------------------------------

  useEffect(() => {
    const r = rig.current
    const el = gl.domElement
    const exploring = () => game.get().phase === 'explore'
    const locked = () => document.pointerLockElement === el
    let drag: { x: number; y: number; moved: boolean } | null = null

    const look = (dx: number, dy: number) => {
      player.yaw -= dx * LOOK_SPEED
      player.pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, player.pitch - dy * LOOK_SPEED))
      if (!game.get().touched) game.set({ touched: true })
    }

    const open = (id: MainId) => {
      if (document.pointerLockElement) document.exitPointerLock()
      if (id === 'switch') {
        game.set({ phase: 'entering', focus: 'switch', aimed: null })
        switchMode('plain')
        return
      }
      const camera = getState().camera as PerspectiveCamera
      const pose = POSES[id]
      r.saved = { position: player.position.clone(), yaw: player.yaw, pitch: player.pitch }
      r.keys.clear()
      game.set({ phase: 'entering', focus: id, aimed: null })
      r.flight = {
        fromPosition: camera.position.clone(),
        fromRotation: camera.quaternion.clone(),
        fromFov: camera.fov,
        toPosition: pose.position.clone(),
        toRotation: poseRotation(pose.position, pose.target),
        toFov: pose.fov,
        seconds: ENTER_SECONDS,
        elapsed: 0,
        onArrive: () => {
          handoff.from = id
          handoff.photoRect =
            id === 'about' ? photoScreenRect(camera, el.clientWidth, el.clientHeight) : null
          navigate(id)
        },
      }
    }

    /** A click, or the E key: use whatever is being pointed at. */
    const act = (mayCapture: boolean) => {
      if (!exploring()) return
      // Aim again right now: a quick click can land before the next frame has caught up with the cursor.
      const camera = getState().camera as PerspectiveCamera
      const aim = findAim(r.raycaster, locked() ? SCREEN_CENTER : r.cursor, camera)
      r.lookDirection.copy(r.raycaster.ray.direction)
      if (aim?.kind === 'main') open(aim.id)
      else if (aim?.kind === 'prop') pokeFloater(aim.index, r.lookDirection)
      else if (mayCapture && !locked()) {
        try {
          void Promise.resolve(el.requestPointerLock()).catch(() => {})
        } catch {
          // Mouse capture is optional: dragging still looks around.
        }
      }
    }

    const setCursor = (e: MouseEvent) => {
      const box = el.getBoundingClientRect()
      r.cursor.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      setCursor(e)
      if (locked()) act(false)
      else drag = { x: e.clientX, y: e.clientY, moved: false }
    }
    const onMouseMove = (e: MouseEvent) => {
      setCursor(e)
      if (!exploring()) return
      if (locked()) look(e.movementX, e.movementY)
      else if (drag) {
        const dx = e.clientX - drag.x
        const dy = e.clientY - drag.y
        if (!drag.moved && Math.hypot(dx, dy) < 4) return
        drag = { x: e.clientX, y: e.clientY, moved: true }
        look(-dx, -dy) // dragging pulls the view, like grabbing it
      }
    }
    const onMouseUp = () => {
      if (drag && !drag.moved) act(true)
      drag = null
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'KeyE' || e.code === 'Enter') act(false)
      r.keys.add(e.code)
      if (exploring() && !game.get().touched && /^(Key[WASD]|Arrow)/.test(e.code)) game.set({ touched: true })
    }
    const onKeyUp = (e: KeyboardEvent) => r.keys.delete(e.code)
    const onLockChange = () => game.set({ locked: locked() })
    const onBlur = () => r.keys.clear()

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('pointerlockchange', onLockChange)
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('pointerlockchange', onLockChange)
      if (document.pointerLockElement === el) document.exitPointerLock()
    }
  }, [gl, getState])

  // --- Every frame --------------------------------------------------------------------------

  useFrame((state, rawDt) => {
    const r = rig.current
    const camera = state.camera as PerspectiveCamera
    const dt = Math.min(rawDt, 0.05)
    const { phase, focus } = game.get()

    if (r.flight) {
      const f = r.flight
      f.elapsed += dt
      const t = ease(Math.min(1, Math.max(0, f.elapsed / f.seconds)))
      camera.position.lerpVectors(f.fromPosition, f.toPosition, t)
      camera.quaternion.slerpQuaternions(f.fromRotation, f.toRotation, t)
      camera.fov = f.fromFov + (f.toFov - f.fromFov) * t
      camera.updateProjectionMatrix()
      if (f.elapsed >= f.seconds) {
        r.flight = null
        f.onArrive()
      }
      return
    }

    if (phase === 'page' && focus && focus !== 'switch') {
      const pose = POSES[focus]
      camera.position.copy(pose.position)
      camera.lookAt(pose.target)
      if (camera.fov !== pose.fov) {
        camera.fov = pose.fov
        camera.updateProjectionMatrix()
      }
      return
    }
    if (phase !== 'explore') return

    // Glide: velocity eases toward what the keys ask for, so starts and stops are soft.
    const forward = Number(r.keys.has('KeyW') || r.keys.has('ArrowUp')) - Number(r.keys.has('KeyS') || r.keys.has('ArrowDown'))
    const strafe = Number(r.keys.has('KeyD') || r.keys.has('ArrowRight')) - Number(r.keys.has('KeyA') || r.keys.has('ArrowLeft'))
    const sin = Math.sin(player.yaw)
    const cos = Math.cos(player.yaw)
    const wanted = scratch.b.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe)
    if (wanted.lengthSq() > 1) wanted.normalize()
    wanted.multiplyScalar(WALK_SPEED)
    player.velocity.lerp(wanted, 1 - Math.exp(-dt * GLIDE))
    player.position.addScaledVector(player.velocity, dt)

    // Stay inside the room and out of the furniture.
    const p = player.position
    p.x = Math.min(ROOM.halfX - PLAYER_RADIUS, Math.max(-ROOM.halfX + PLAYER_RADIUS, p.x))
    p.z = Math.min(ROOM.halfZ - PLAYER_RADIUS, Math.max(-ROOM.halfZ + PLAYER_RADIUS, p.z))
    for (const [minX, maxX, minZ, maxZ] of OBSTACLES) {
      const left = p.x - (minX - PLAYER_RADIUS)
      const right = maxX + PLAYER_RADIUS - p.x
      const near = p.z - (minZ - PLAYER_RADIUS)
      const far = maxZ + PLAYER_RADIUS - p.z
      if (left <= 0 || right <= 0 || near <= 0 || far <= 0) continue
      const least = Math.min(left, right, near, far)
      if (least === left) p.x = minX - PLAYER_RADIUS
      else if (least === right) p.x = maxX + PLAYER_RADIUS
      else if (least === near) p.z = minZ - PLAYER_RADIUS
      else p.z = maxZ + PLAYER_RADIUS
    }

    // Upright always: only yaw and pitch, no roll, plus a barely-there idle drift.
    camera.position.set(p.x, EYE_HEIGHT + Math.sin(performance.now() * 0.0007) * 0.012, p.z)
    camera.quaternion.setFromEuler(scratch.euler.set(player.pitch, player.yaw, 0))
    if (camera.fov !== BASE_FOV) {
      camera.fov = BASE_FOV
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()

    const canvas = state.gl.domElement
    const captured = document.pointerLockElement === canvas
    const aim = findAim(r.raycaster, captured ? SCREEN_CENTER : r.cursor, camera)
    r.aim = aim
    r.lookDirection.copy(r.raycaster.ray.direction)
    const aimed = aim?.kind === 'main' ? aim.id : aim ? 'prop' : null
    if (aimed !== game.get().aimed) game.set({ aimed })
    canvas.style.cursor = captured ? 'none' : aimed ? 'pointer' : 'grab'
  })

  return null
}
