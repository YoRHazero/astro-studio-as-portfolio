import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import { part } from './cabin'
import { floaters, stepFloaters, type FloaterKind } from './floaters'
import { ModelLoader, PROPS_MODEL_URL } from './models'

/** The pen and the notebook come from props.glb; the water is made here, so it can wobble. */
function useShapes(): Record<FloaterKind, ReactNode> {
  const gltf = useLoader(ModelLoader, PROPS_MODEL_URL)
  return useMemo(() => {
    // Each prop's origin is its own centre; where it floats is decided by floaters.ts.
    const prop = (name: string) => {
      const object = part(gltf.scene, name).clone()
      object.position.set(0, 0, 0)
      object.traverse((child) => {
        if (!(child as Mesh).isMesh) return
        child.castShadow = true
        child.receiveShadow = true
      })
      return <primitive object={object} dispose={null} />
    }
    return {
      pen: prop('prop_pen'),
      notebook: prop('prop_notebook'),
      // A ball of water. Poke it.
      blob: (
        <mesh castShadow>
          <sphereGeometry args={[0.07, 32, 24]} />
          <meshPhysicalMaterial
            color="#e6f5ff"
            roughness={0.05}
            metalness={0}
            transmission={0.95}
            thickness={0.1}
            ior={1.33}
          />
        </mesh>
      ),
    }
  }, [gltf.scene])
}

/** Draws the drifting objects and advances their motion. */
export function FloatingProps() {
  const shapes = useShapes()
  const groups = useRef<(Group | null)[]>([])
  useFrame((_, dt) => {
    stepFloaters(Math.min(dt, 0.05))
    const time = performance.now() * 0.012
    floaters.forEach((f, i) => {
      const group = groups.current[i]
      if (!group) return
      group.position.copy(f.position)
      group.quaternion.copy(f.rotation)
      if (f.kind === 'blob') {
        const squash = Math.sin(time) * 0.28 * f.wobble
        group.scale.set(1 + squash, 1 - squash, 1 + squash * 0.5)
      }
    })
  })
  return (
    <>
      {floaters.map((f, i) => (
        <group
          key={f.kind}
          ref={(group) => {
            groups.current[i] = group
          }}
        >
          {shapes[f.kind]}
        </group>
      ))}
    </>
  )
}
