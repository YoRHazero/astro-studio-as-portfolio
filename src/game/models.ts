import { useLoader } from '@react-three/fiber'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { loading, reportDownload } from '../loading'
import { EARTH_MODEL_URL } from './earth-model'

// Every model the game needs, and the loader that tells the loading screen how they are coming along.

export const CABIN_MODEL_URL = `${import.meta.env.BASE_URL}models/cabin.glb`
export const PROPS_MODEL_URL = `${import.meta.env.BASE_URL}models/props.glb`

const MODELS = [CABIN_MODEL_URL, EARTH_MODEL_URL, PROPS_MODEL_URL]

/** A GLTFLoader that reports its bytes. Use it everywhere, so all lookups share one cache. */
export class ModelLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ) {
    let size = 0
    super.load(
      url,
      (gltf) => {
        reportDownload(url, size, size, true)
        onLoad(gltf)
      },
      (event) => {
        size = event.lengthComputable ? event.total : 0
        reportDownload(url, event.loaded, size)
        onProgress?.(event)
      },
      onError,
    )
  }
}

/** Start every download at once, as soon as the game's code has arrived. */
export function preloadModels() {
  for (const url of MODELS) {
    reportDownload(url, 0, 0)
    useLoader.preload(ModelLoader, url)
  }
  loading.set({ started: true })
}
