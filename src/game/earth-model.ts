import {
  BackSide,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
  type MeshStandardMaterial,
  type Object3D,
} from 'three'
import { updateEarthRotation } from './earth-rotation'

export const EARTH_MODEL_URL = `${import.meta.env.BASE_URL}models/earth.glb`
export const EARTH_POSITION = [70, -300, -350] as const
export const EARTH_RADIUS = 270

/** Uses the original cabin sunlight, preserving the window's light/dark boundary. */
function atmosphereMaterial() {
  return new ShaderMaterial({
    name: 'earth_atmosphere_limb',
    uniforms: {
      glowColor: { value: new Color('#5aafff') },
      sunDirection: { value: new Vector3(-1.6, 6.2, -12.5).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform vec3 sunDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 eye = normalize(cameraPosition - vWorldPosition);
        float mu = abs(dot(n, eye));
        float rim = pow(1.0 - mu, 3.0) * smoothstep(0.0, 0.13, mu);
        float lit = mix(0.16, 1.0, smoothstep(-0.35, 0.55, dot(n, sunDirection)));
        gl_FragColor = vec4(glowColor * (0.75 + lit), rim * lit * 0.72);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: BackSide,
  })
}

/** Clone the exported model; cached geometry and image textures stay shared. */
export function createEarthInstance(source: Object3D) {
  const earth = new Group()
  earth.name = 'earth_placement'
  earth.position.fromArray(EARTH_POSITION)
  earth.scale.setScalar(EARTH_RADIUS)
  const model = source.clone(true)
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = false
    object.receiveShadow = false
    if (object.name === 'earth_atmosphere') {
      object.material = atmosphereMaterial()
      object.renderOrder = 2
    } else {
      const material = (object.material as MeshStandardMaterial).clone()
      if (material.map) material.map.anisotropy = 8
      if (object.name === 'earth_clouds') {
        material.depthWrite = false
        object.renderOrder = 1
      }
      object.material = material
    }
  })
  earth.add(model)
  updateEarthRotation(earth)
  return earth
}

/** Dispose only per-instance materials, not loader-cached geometry or textures. */
export function disposeEarthInstance(earth: Object3D) {
  earth.traverse((object) => {
    if (!(object instanceof Mesh)) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose()
  })
}
