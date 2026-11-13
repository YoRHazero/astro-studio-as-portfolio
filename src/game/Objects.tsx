import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import {
  CanvasTexture,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Mesh,
  type Object3D,
  type SpotLight,
  type Texture,
} from 'three'
import { about, ACCENT, site } from '../content'
import { drawLock } from '../lockscreen'
import { modeStore } from '../mode'
import { part, useCabin } from './cabin'
import { FRAME, type MainId } from './layout'
import { game } from './state'

// The parts of the cabin model that code brings to life: the four flat surfaces that show
// drawn or loaded pictures, the main switch's beacon, the reading lamp,
// and the main switch's lever. Parts are found by their exported names in cabin.glb.

// Each beacon sits on a lamp the model already has (its emit_* accent), so it takes that lamp's
// colour. On the switch that is the panel's green status light.
const SWITCH_COLOR = '#7dffa5'
const COLOR: Record<MainId, string> = { ...ACCENT, switch: SWITCH_COLOR }

/** A picture drawn once into a canvas. glTF UVs start at the top, so it must not be flipped. */
function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!, width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.anisotropy = 8
  return texture
}

/** Like useMemo for a texture, but frees it from the GPU when the game goes away. */
function useTexture<T extends Texture>(make: () => T, deps: unknown[] = []) {
  // The drawings only depend on content, which is fixed for the lifetime of the page.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  const texture = useMemo(make, deps)
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** Shows a texture on one of the model's `surface_*` quads, unlit, in place of its stand-in material. */
function useSurface(name: string, texture: Texture) {
  const cabin = useCabin()
  useLayoutEffect(() => {
    const mesh = part<Mesh>(cabin, name)
    const exported = mesh.material
    const material = new MeshBasicMaterial({ map: texture, toneMapped: false })
    mesh.material = material
    return () => {
      mesh.material = exported
      material.dispose()
    }
  }, [cabin, name, texture])
}

/** Where one of the model's Empty anchors is. */
function useAnchor(name: string) {
  const cabin = useCabin()
  return useMemo(() => part(cabin, name).getWorldPosition(new Vector3()), [cabin, name])
}

/** A small light that marks an object as something you can open. It swells when pointed at. */
function Beacon({ id }: { id: MainId }) {
  const position = useAnchor(`beacon_${id}`)
  const mesh = useRef<Mesh>(null)
  useFrame(() => {
    if (!mesh.current) return
    const aimed = game.get().aimed === id
    const pulse = 1 + 0.25 * Math.sin(performance.now() * 0.004)
    const wanted = (aimed ? 1.7 : 1) * pulse
    mesh.current.scale.setScalar(mesh.current.scale.x + (wanted - mesh.current.scale.x) * 0.2)
  })
  return (
    <group position={position}>
      <mesh ref={mesh}>
        <sphereGeometry args={[0.022, 16, 12]} />
        <meshStandardMaterial
          color="#0d1118"
          emissive={COLOR[id]}
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={COLOR[id]} intensity={0.25} distance={2} />
    </group>
  )
}

/** Code: the monitor shows the computer's lock screen, live — the same clock the Code page starts from. */
function Screen() {
  const display = useTexture(() => canvasTexture(960, 600, drawLock))
  useSurface('surface_screen', display)
  const live = useRef({ texture: display, drawn: 0 })
  useFrame(() => {
    // The clock only drifts slowly; a few redraws a second are plenty.
    const now = performance.now()
    const screen = live.current
    if (now - screen.drawn < 120) return
    screen.drawn = now
    const canvas = screen.texture.image as HTMLCanvasElement
    drawLock(canvas.getContext('2d')!, canvas.width, canvas.height)
    screen.texture.needsUpdate = true
  })
  return null
}

/** About: the visitor's own photo, cropped to the frame's 4:5 like `object-fit: cover`. */
function Photo({ url }: { url: string }) {
  const loaded = useLoader(TextureLoader, url)
  const texture = useTexture(() => {
    const t = loaded.clone()
    t.colorSpace = SRGBColorSpace
    t.flipY = false
    t.anisotropy = 8
    const image = t.image as { width: number; height: number }
    const aspect = image.width / image.height
    const frame = FRAME.photo.width / FRAME.photo.height
    if (aspect > frame) t.repeat.set(frame / aspect, 1)
    else t.repeat.set(1, aspect / frame)
    t.offset.set((1 - t.repeat.x) / 2, (1 - t.repeat.y) / 2)
    t.needsUpdate = true
    return t
  }, [loaded])
  useSurface('surface_photo', texture)
  return null
}

/** The plate on the frame's foot: name and role. */
function Nameplate() {
  const plate = useTexture(() =>
    canvasTexture(640, 140, (ctx, w, h) => {
      ctx.fillStyle = '#151e25'
      ctx.fillRect(0, 0, w, h)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f0e6d2'
      ctx.font = '600 50px -apple-system, "Segoe UI", sans-serif'
      ctx.fillText(site.name, w / 2, 64)
      ctx.fillStyle = '#a89f8d'
      ctx.font = '28px -apple-system, "Segoe UI", sans-serif'
      ctx.fillText(about.role, w / 2, 110)
    }),
  )
  useSurface('surface_nameplate', plate)
  return null
}

/** The warm reading lamp over the photo, hanging from its anchor in the model. */
function ReadingLamp() {
  const head = useAnchor('lamp_about')
  const light = useRef<SpotLight>(null)
  useLayoutEffect(() => {
    // The target is not part of the scene, so its matrix has to be brought up to date by hand.
    const target = light.current?.target
    if (!target) return
    target.position.set(FRAME.photo.center.x, 0.9, FRAME.photo.center.z)
    target.updateMatrixWorld()
  }, [])
  return (
    <spotLight
      ref={light}
      position={head}
      intensity={9}
      angle={0.62}
      penumbra={0.9}
      distance={4}
      color="#ffcf99"
    />
  )
}

/** How far the lever swings about its own X axis when thrown: down, and out toward the room. */
const LEVER_THROWN = -1.15

/** Throwing the main switch turns the lights out and brings up the plain site. */
function Lever() {
  const cabin = useCabin()
  const lever = useRef<{ object: Object3D; rest: number } | null>(null)
  useLayoutEffect(() => {
    const object = part(cabin, 'switch_lever')
    lever.current = { object, rest: object.rotation.x }
  }, [cabin])
  useFrame((_, dt) => {
    if (!lever.current) return
    const { object, rest } = lever.current
    // Both ways of leaving for the plain site (the switch and the HUD button) throw it.
    const wanted = rest + (modeStore.get().fading ? LEVER_THROWN : 0)
    object.rotation.x += (wanted - object.rotation.x) * (1 - Math.exp(-dt * 14))
  })
  return null
}

/** Decoration: a quasar spectrum with broad emission lines on the wall monitor. */
function Spectrum() {
  const plot = useTexture(() =>
    canvasTexture(1100, 630, (ctx, w, h) => {
      ctx.fillStyle = '#070b12'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#1c2636'
      ctx.lineWidth = 1
      for (let x = 80; x < w; x += 120) {
        ctx.beginPath()
        ctx.moveTo(x, 40)
        ctx.lineTo(x, h - 70)
        ctx.stroke()
      }
      const lines = [
        { at: 0.2, widthOf: 0.022, strength: 1.0, name: 'Lyα' },
        { at: 0.235, widthOf: 0.016, strength: 0.32, name: '' },
        { at: 0.44, widthOf: 0.02, strength: 0.42, name: 'C IV' },
        { at: 0.66, widthOf: 0.022, strength: 0.25, name: 'C III]' },
        { at: 0.9, widthOf: 0.02, strength: 0.3, name: 'Mg II' },
      ]
      let noise = 3
      const random = () => (noise = (noise * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5
      ctx.strokeStyle = '#ff9a6b'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      for (let px = 0; px <= w - 120; px += 3) {
        const u = px / (w - 120)
        let flux = 0.16 * Math.pow(1.4 - u, 0.7)
        for (const l of lines) flux += l.strength * Math.exp(-((u - l.at) ** 2) / (2 * l.widthOf ** 2))
        // Blueward of Lyα the forest eats the continuum.
        if (u < 0.18) flux *= 0.12 + Math.abs(random()) * 0.35
        flux += random() * 0.02
        const y = h - 80 - flux * (h - 170)
        if (px === 0) ctx.moveTo(60 + px, y)
        else ctx.lineTo(60 + px, y)
      }
      ctx.stroke()
      ctx.fillStyle = '#8f9bb0'
      ctx.font = '24px ui-monospace, Menlo, monospace'
      for (const l of lines) if (l.name) ctx.fillText(l.name, 60 + l.at * (w - 120) - 20, h - 30)
      ctx.fillStyle = '#e8edf5'
      ctx.fillText('Observed spectrum', 60, 34)
    }),
  )
  useSurface('surface_spectrum', plot)
  return null
}

export function Objects() {
  return (
    <group>
      <Screen />
      {/* Without a photo the frame keeps the model's own blank card. */}
      {about.photo && <Photo url={about.photo} />}
      <Nameplate />
      <ReadingLamp />
      <Lever />
      <Spectrum />
      <Beacon id="switch" />
    </group>
  )
}
