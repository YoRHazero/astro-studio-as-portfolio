import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  type DirectionalLight,
  type HemisphereLight,
  type Mesh,
  type PointLight,
} from 'three'
import { publications } from '../content'
import { modeStore } from '../mode'
import { CabinContext } from './cabin'
import { Earth } from './Earth'
import { HULL, TELESCOPE, TERMINAL } from './layout'
import { CABIN_MODEL_URL, ModelLoader } from './models'

// The module itself is the Blender model in public/models/cabin.glb.
// This file adds what the model leaves to code: the sky outside the window and the lighting.

const { apothem, centerY, halfLength } = HULL

/** A soft round dot, so stars are not drawn as squares. */
function useDotTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    glow.addColorStop(0, 'rgb(255 255 255 / 1)')
    glow.addColorStop(0.3, 'rgb(255 255 255 / 0.6)')
    glow.addColorStop(1, 'rgb(255 255 255 / 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, 64, 64)
    return new CanvasTexture(canvas)
  }, [])
}

function pointsGeometry(positions: number[]) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  return geometry
}

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Everything outside the window: stars, the planet, and one source per publication. */
export function Sky() {
  const dot = useDotTexture()

  const stars = useMemo(() => {
    const random = seeded(11)
    const positions: number[] = []
    for (let i = 0; i < 2600; i++) {
      const u = random() * 2 - 1
      const phi = random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      positions.push(r * Math.cos(phi) * 600, u * 600, r * Math.sin(phi) * 600)
    }
    return pointsGeometry(positions)
  }, [])

  // The field the telescope is pointed at. Each paper is one source; selected ones are brighter.
  const sources = useMemo(() => {
    const random = seeded(5)
    const faint: number[] = []
    const bright: number[] = []
    const { eyepiece, direction } = TELESCOPE
    for (const pub of publications) {
      const dx = (random() - 0.5) * 0.36
      const dy = (random() - 0.5) * 0.2
      ;(pub.selected ? bright : faint).push(
        eyepiece.x + (direction.x + dx) * 500,
        eyepiece.y + (direction.y + dy) * 500,
        eyepiece.z + direction.z * 500,
      )
    }
    return { faint: pointsGeometry(faint), bright: pointsGeometry(bright) }
  }, [])

  return (
    <group>
      <points geometry={stars}>
        <pointsMaterial map={dot} size={2.2} sizeAttenuation={false} transparent depthWrite={false} />
      </points>
      {(['faint', 'bright'] as const).map((kind) => (
        <points key={kind} geometry={sources[kind]}>
          <pointsMaterial
            map={dot}
            color={kind === 'bright' ? '#ff9a6b' : '#ff6a4a'}
            size={kind === 'bright' ? 13 : 8}
            sizeAttenuation={false}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      ))}
      <Earth />
    </group>
  )
}

/**
 * Lighting. The module is dim: sunlight comes in through the window and throws the telescope's
 * shadow down the deck, and everything else is small practical lights. The main switch fades it out.
 * The reading lamp over the photo hangs from an anchor in the model, so it lives in Objects.tsx.
 */
function Lights() {
  const ambient = useRef<HemisphereLight>(null)
  const sun = useRef<DirectionalLight>(null)
  const strips = useRef<(PointLight | null)[]>([])
  const level = useRef(1)
  useFrame((_, dt) => {
    const wanted = modeStore.get().fading ? 0 : 1
    level.current += (wanted - level.current) * (1 - Math.exp(-dt * 8))
    if (ambient.current) ambient.current.intensity = 0.3 * level.current
    if (sun.current) sun.current.intensity = 4.2 * level.current
    strips.current.forEach((light) => light && (light.intensity = 3.2 * level.current))
  })
  return (
    <>
      <hemisphereLight ref={ambient} args={['#9fb4d8', '#1a1d24', 0.3]} />
      {/* The sun, low behind the window */}
      <directionalLight
        ref={sun}
        position={[-1.6, 6.2, -halfLength - 8]}
        intensity={4.2}
        color="#ffe6c7"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.012}
      >
        <orthographicCamera attach="shadow-camera" args={[-5, 5, 6, -6, 1, 30]} />
      </directionalLight>
      {/* A faint cool wash from the ceiling strip, so the far end is never pitch black */}
      {[-1.8, 1.8].map((z, i) => (
        <pointLight
          key={z}
          ref={(light) => {
            strips.current[i] = light
          }}
          position={[0, centerY + apothem - 0.5, z]}
          intensity={3.2}
          distance={7}
          color="#8fb0e8"
        />
      ))}
      {/* The glow of the terminal */}
      <pointLight
        position={[TERMINAL.screen.center.x - 0.35, TERMINAL.screen.center.y, TERMINAL.screen.center.z]}
        intensity={1.0}
        distance={2.8}
        color="#7cc7ff"
      />
    </>
  )
}

/** The module, lit, with whatever goes inside it. Children can reach the model with useCabin(). */
export function Room({ children }: { children?: ReactNode }) {
  const gltf = useLoader(ModelLoader, CABIN_MODEL_URL)
  // A copy per visit, so the materials swapped in below never touch the loader's cached original.
  // Geometry and the model's own materials stay shared, and are never disposed.
  const cabin = useMemo(() => {
    const scene = gltf.scene.clone(true)
    scene.traverse((object) => {
      if (!(object as Mesh).isMesh) return
      object.castShadow = true
      object.receiveShadow = true
    })
    scene.updateMatrixWorld(true)
    return scene
  }, [gltf.scene])

  return (
    <CabinContext value={cabin}>
      <Lights />
      <primitive object={cabin} dispose={null} />
      {children}
    </CabinContext>
  )
}
