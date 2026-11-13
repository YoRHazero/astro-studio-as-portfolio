import { useEffect, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { createEarthInstance, disposeEarthInstance, EARTH_MODEL_URL } from './earth-model'
import { updateEarthRotation } from './earth-rotation'
import { ModelLoader } from './models'

export function Earth() {
  const gltf = useLoader(ModelLoader, EARTH_MODEL_URL)
  const earth = useMemo(() => createEarthInstance(gltf.scene), [gltf.scene])
  useFrame(() => updateEarthRotation(earth))
  useEffect(() => () => disposeEarthInstance(earth), [earth])
  return <primitive object={earth} dispose={null} />
}
