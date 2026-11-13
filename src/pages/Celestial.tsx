import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  type Group,
  type ShaderMaterial,
} from 'three'

// What a source turns out to be once you push in on it. Two kinds, chosen per paper:
//   blackhole — an active nucleus: a black hole, its accretion disk, and a jet from each pole
//   galaxy    — a spiral galaxy: a bulge, two or three arms, and now and then a supernova
// Both are clouds of points that move on the GPU, and each paper gets its own, generated
// from its folder name.

export type CelestialKind = 'blackhole' | 'galaxy'

const DISK_POINTS = 9000
const JET_POINTS = 1600
const GALAXY_POINTS = 14000
const SUPERNOVAE = 12
const HOLE_RADIUS = 0.62
const INNER_EDGE = 0.82

function randomFrom(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uOuter;
  uniform float uJet;
  uniform vec3 uHot;
  uniform vec3 uCool;
  attribute vec4 aOrbit; // disk and stars: radius, phase, thickness, size · jet: spread, phase, pole, size
  attribute float aKind; // 0 = disk, 1 = jet, 2 = galaxy star, 3 = a star that will go supernova
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p;
    float boost = 1.0;
    if (aKind < 0.5) {
      // Keplerian: the inner disk laps the outer disk many times over.
      float r = aOrbit.x;
      float angle = aOrbit.y + uTime * 0.9 * pow(r, -1.5);
      p = vec3(cos(angle) * r, aOrbit.z * (0.02 + r * 0.035), sin(angle) * r);
      float outward = smoothstep(${INNER_EDGE.toFixed(2)}, uOuter, r);
      vColor = mix(uHot, uCool, pow(outward, 0.6));
      // Relativistic beaming: the side turning toward us is brighter.
      vAlpha = (1.0 - outward * 0.75) * (1.0 + 0.55 * cos(angle));
    } else if (aKind > 1.5) {
      // A galaxy turns almost like a solid wheel near the middle and lags further out.
      float r = aOrbit.x;
      float angle = aOrbit.y + uTime * 0.22 / (0.45 + r);
      float thickness = 0.03 + 0.3 * exp(-r * 1.6);
      p = vec3(cos(angle) * r, aOrbit.z * thickness, sin(angle) * r);
      float outward = smoothstep(0.15, uOuter * 0.6, r);
      vColor = mix(uHot, uCool, outward);
      vAlpha = 0.75 * (1.0 - smoothstep(uOuter * 0.55, uOuter, r) * 0.8);
      if (aKind > 2.5) {
        // Each of these stars explodes on its own clock: a sudden flash, then a slow fade.
        float period = 18.0 + 22.0 * fract(aOrbit.y * 7.31);
        float age = fract(uTime / period + fract(aOrbit.y * 3.17)) * period;
        float flare = smoothstep(0.0, 0.1, age) * exp(-age * 1.3);
        vColor = mix(vColor, vec3(0.92, 0.96, 1.0), min(1.0, flare * 3.0));
        vAlpha += flare * 4.0;
        boost = 1.0 + flare * 7.0;
      }
    } else {
      float along = fract(aOrbit.y + uTime * 0.12 * (0.6 + aOrbit.x));
      float height = along * 4.2;
      float radius = (0.03 + height * 0.07) * aOrbit.x;
      float angle = aOrbit.y * 40.0 + uTime * 0.5;
      p = vec3(cos(angle) * radius, aOrbit.z * (0.35 + height), sin(angle) * radius);
      vColor = mix(vec3(0.75, 0.85, 1.0), uHot, 0.3);
      vAlpha = (1.0 - along) * 0.7 * uJet;
    }
    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aOrbit.w * boost * uSize / -viewPosition.z;
  }
`

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float falloff = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vColor, falloff * falloff * vAlpha);
  }
`

function packed(orbit: Float32Array, kind: Float32Array) {
  const geometry = new BufferGeometry()
  // The shader places every point, so `position` only has to exist.
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(kind.length * 3), 3))
  geometry.setAttribute('aOrbit', new BufferAttribute(orbit, 4))
  geometry.setAttribute('aKind', new BufferAttribute(kind, 1))
  return geometry
}

function blackHole(random: () => number) {
  const outer = 2.6 + random() * 1.1
  const orbit = new Float32Array((DISK_POINTS + JET_POINTS) * 4)
  const kind = new Float32Array(DISK_POINTS + JET_POINTS)
  const look = {
    outer,
    tilt: 0.2 + random() * 0.4,
    roll: (random() - 0.5) * 0.9,
    cool: new Color().setHSL(0.02 + random() * 0.07, 1, 0.5 + random() * 0.08),
    hot: new Color().setHSL(0.09 + random() * 0.05, 1, 0.9),
    jet: 0.45 + random() * 0.55,
  }
  for (let i = 0; i < DISK_POINTS; i++) {
    orbit.set(
      [
        INNER_EDGE + (outer - INNER_EDGE) * Math.pow(random(), 1.7),
        random() * Math.PI * 2,
        (random() - 0.5) * 2,
        1 + random() * 1.6,
      ],
      i * 4,
    )
  }
  for (let i = DISK_POINTS; i < DISK_POINTS + JET_POINTS; i++) {
    orbit.set([random(), random(), random() < 0.5 ? -1 : 1, 0.8 + random() * 1.2], i * 4)
    kind[i] = 1
  }
  return { ...look, geometry: packed(orbit, kind) }
}

function galaxy(random: () => number) {
  const outer = 3.3 + random() * 0.6
  const arms = 2 + Math.floor(random() * 2)
  const winding = 2.2 + random() * 1.6
  const orbit = new Float32Array(GALAXY_POINTS * 4)
  const kind = new Float32Array(GALAXY_POINTS)
  const look = {
    outer,
    // Seen from well above the plane, so the arms read as arms.
    tilt: 0.75 + random() * 0.45,
    roll: (random() - 0.5) * 1.2,
    cool: new Color().setHSL(0.58 + random() * 0.06, 0.85, 0.72),
    hot: new Color().setHSL(0.1 + random() * 0.03, 1, 0.82),
    jet: 0,
  }
  // Roughly normal scatter, so arms have soft edges rather than hard ones.
  const scatter = () => (random() + random() + random() - 1.5) / 1.5
  for (let i = 0; i < GALAXY_POINTS; i++) {
    const inBulge = random() < 0.24
    const radius = inBulge ? Math.pow(random(), 1.8) * 0.9 : 0.25 + Math.pow(random(), 0.75) * (outer - 0.25)
    // A logarithmic spiral: each arm trails further round the further out it goes.
    const arm = (Math.floor(random() * arms) / arms) * Math.PI * 2
    const angle = inBulge
      ? random() * Math.PI * 2
      : arm + winding * Math.log(1 + radius) + scatter() * (0.55 - radius * 0.07)
    orbit.set([radius, angle, scatter(), 0.7 + random() * 1.4], i * 4)
    // A handful of stars out in the arms are marked to go supernova, one every few seconds between them.
    kind[i] = !inBulge && i % Math.round(GALAXY_POINTS / SUPERNOVAE) === 0 ? 3 : 2
  }
  return { ...look, geometry: packed(orbit, kind) }
}

function Body({ seed, kind }: { seed: string; kind: CelestialKind }) {
  const tilted = useRef<Group>(null)
  const material = useRef<ShaderMaterial>(null)
  const pixelRatio = useThree((s) => s.viewport.dpr)
  const still = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const look = useMemo(() => {
    const random = randomFrom(seed)
    const made = kind === 'galaxy' ? galaxy(random) : blackHole(random)
    const uniforms = {
      uTime: { value: 0 },
      uSize: { value: 22 },
      uOuter: { value: made.outer },
      uJet: { value: made.jet },
      uHot: { value: made.hot },
      uCool: { value: made.cool },
    }
    return { ...made, uniforms }
  }, [seed, kind])

  const glow = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgb(255 255 255 / 0.55)')
    gradient.addColorStop(0.25, 'rgb(255 255 255 / 0.16)')
    gradient.addColorStop(1, 'rgb(255 255 255 / 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)
    return new CanvasTexture(canvas)
  }, [])

  useFrame((state) => {
    const time = still ? 12 : state.clock.elapsedTime + 12
    if (material.current) {
      material.current.uniforms.uTime.value = time
      material.current.uniforms.uSize.value = 22 * pixelRatio
    }
    // The whole thing breathes very slightly, so it never looks like a still image.
    if (tilted.current) tilted.current.rotation.x = look.tilt + Math.sin(time * 0.15) * 0.04
  })

  return (
    <group>
      {/* Soft halo: the glow of the disk, or of the galaxy's core */}
      <mesh>
        <planeGeometry args={kind === 'galaxy' ? [5, 5] : [9, 9]} />
        <meshBasicMaterial
          map={glow}
          color={kind === 'galaxy' ? look.hot : look.cool}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {kind === 'blackhole' && (
        <>
          {/* The hole itself: nothing, but it hides whatever passes behind it. */}
          <mesh>
            <sphereGeometry args={[HOLE_RADIUS, 48, 32]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          {/* Photon ring: always face-on to us, whichever way the disk leans. */}
          <mesh position-z={0.01}>
            <ringGeometry args={[HOLE_RADIUS, HOLE_RADIUS + 0.07, 96]} />
            <meshBasicMaterial color="#ffe2c4" transparent opacity={0.85} depthTest={false} blending={AdditiveBlending} />
          </mesh>
        </>
      )}
      <group ref={tilted} rotation={[look.tilt, 0, look.roll]}>
        <points geometry={look.geometry} frustumCulled={false}>
          <shaderMaterial
            ref={material}
            vertexShader={VERTEX}
            fragmentShader={FRAGMENT}
            uniforms={look.uniforms}
            transparent
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>
    </group>
  )
}

/** `kind` and `seed` pick what is drawn; `active` stops the drawing while the paper is closed. */
export default function Celestial({ kind, seed, active }: { kind: CelestialKind; seed: string; active: boolean }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 2]}
      // Measure the layout box, not the on-screen box: the container is scaled while it unfolds.
      resize={{ offsetSize: true }}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: 35, position: [0, 0, 11] }}
    >
      <Body key={kind + seed} seed={seed} kind={kind} />
    </Canvas>
  )
}
