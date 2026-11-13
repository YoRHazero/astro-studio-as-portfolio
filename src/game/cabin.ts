import { createContext, useContext } from 'react'
import type { Object3D } from 'three'

// Code finds the Blender models' parts by name. These names are a contract:
// renaming something in Blender breaks the lookups below.

/** This visit's copy of the cabin. Provided by <Room>. */
export const CabinContext = createContext<Object3D | null>(null)

export function useCabin() {
  const cabin = useContext(CabinContext)
  if (!cabin) throw new Error('useCabin() is only available inside <Room>')
  return cabin
}

/** A named part of a model. A missing name is a broken export, so fail loudly. */
export function part<T extends Object3D = Object3D>(model: Object3D, name: string): T {
  const object = model.getObjectByName(name)
  if (!object) throw new Error(`The model has no object named "${name}". Check the exported GLB in public/models/.`)
  return object as T
}
